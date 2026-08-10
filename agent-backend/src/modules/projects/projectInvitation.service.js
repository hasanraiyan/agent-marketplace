import { clerkClient } from '@clerk/express';
import config from '../../config/index.js';
import { loggerService } from '../../utils/index.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import projectRepository from './project.repository.js';
import projectInvitationRepository from './projectInvitation.repository.js';
import projectMembershipService from './projectMembership.service.js';
import projectMembershipRepository from './projectMembership.repository.js';
import userRepository from '../users/user.repository.js';
import auditLogService from '../audit/auditLog.service.js';
import { INVITATION_STATUS } from './projectInvitation.model.js';
import { MEMBERSHIP_ROLE } from './projectMembership.model.js';

const logger = loggerService.getLogger();

const INVITATION_EXPIRES_IN_DAYS = 7;

class ProjectInvitationService {
  /**
   * Creates a Clerk invitation for someone without a Persona account yet
   * (AD-08 §11 — the full invitation workflow). Clerk owns email delivery
   * and the accept/sign-up flow; when the invitee accepts, the
   * `invitation.accepted` webhook grants the Admin membership.
   *
   * Inviting an email that already maps to a Persona account is rejected —
   * adding them directly is the right path in that case.
   */
  async createInvitation(projectId, email, actorPersonaUserId) {
    const normalizedEmail = email.trim().toLowerCase();

    let existingUser = null;
    try {
      existingUser = await userRepository.findByEmail(normalizedEmail);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
    if (existingUser) {
      throw new ValidationError(
        'This user already has a Persona account — add them directly instead'
      );
    }

    // Idempotency: reuse an existing pending invitation for the same email.
    const existing = await projectInvitationRepository.findPendingByProjectAndEmail(
      projectId,
      normalizedEmail
    );
    if (existing) {
      return existing;
    }

    const project = await projectRepository.findById(projectId);

    const clerkInvitation = await clerkClient.invitations.createInvitation({
      emailAddress: normalizedEmail,
      redirectUrl:
        `${config.websiteUrl}developer/invitations/accept` +
        `?email=${encodeURIComponent(normalizedEmail)}` +
        `&projectId=${encodeURIComponent(projectId)}`,
      publicMetadata: {
        projectId: String(project._id),
        role: MEMBERSHIP_ROLE.ADMIN,
      },
      expiresInDays: INVITATION_EXPIRES_IN_DAYS,
      notify: true,
    });

    const expiresAt = new Date(Date.now() + INVITATION_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    let invitation;
    try {
      invitation = await projectInvitationRepository.create({
        project: projectId,
        email: normalizedEmail,
        clerkInvitationId: clerkInvitation.id,
        role: MEMBERSHIP_ROLE.ADMIN,
        status: INVITATION_STATUS.PENDING,
        expiresAt,
        invitedBy: actorPersonaUserId,
      });
    } catch (error) {
      // Race backstop: two concurrent invites for the same email both cleared
      // the pre-check; the partial unique index (project, email) where
      // pending rejects the second. Return the winner instead of a 500.
      if (error.code === 11000) {
        const winner = await projectInvitationRepository.findPendingByProjectAndEmail(
          projectId,
          normalizedEmail
        );
        if (winner) return winner;
      }
      throw error;
    }

    await auditLogService.record({
      eventType: 'invitation.created',
      actorContextType: 'ProjectAdmin',
      actorIdentity: actorPersonaUserId,
      targetDomain: projectId,
      targetResourceId: invitation._id,
      metadata: { email: normalizedEmail, role: MEMBERSHIP_ROLE.ADMIN },
    });

    return invitation;
  }

  async listInvitations(projectId) {
    // Clerk fires no webhook when an invitation expires, so flip any
    // past-due pending rows to 'expired' before listing (AD-08 §11).
    await projectInvitationRepository.markPendingExpiredBefore();
    return await projectInvitationRepository.findByProject(projectId);
  }

  /**
   * Revokes a pending invitation in Clerk (killing the emailed link) and
   * marks the local row revoked. Non-pending invitations are rejected.
   */
  async revokeInvitation(projectId, invitationId, actorPersonaUserId) {
    const invitation = await projectInvitationRepository.findById(invitationId);
    if (!invitation || String(invitation.project) !== String(projectId)) {
      throw new NotFoundError('Invitation not found', 'ProjectInvitation');
    }
    if (invitation.status !== INVITATION_STATUS.PENDING) {
      throw new ValidationError(`Cannot revoke a ${invitation.status} invitation`);
    }

    // Revoke in Clerk first — if that fails, the local row stays pending so
    // the admin can retry (the emailed accept link must stop working).
    await clerkClient.invitations.revokeInvitation(invitation.clerkInvitationId);

    const revoked = await projectInvitationRepository.markRevoked(invitation._id);

    await auditLogService.record({
      eventType: 'invitation.revoked',
      actorContextType: 'ProjectAdmin',
      actorIdentity: actorPersonaUserId,
      targetDomain: projectId,
      targetResourceId: invitation._id,
      metadata: { email: invitation.email },
    });

    return revoked;
  }

  /**
   * Orphan healing (invitation.created webhook): if the Clerk invitation
   * succeeded but the local row write failed (crashed create), backfill the
   * row. No-op when the row already exists or the payload isn't a Project
   * invitation (no public_metadata.projectId).
   */
  async backfillCreatedInvitation(data) {
    const clerkInvitationId = data?.id;
    const projectId = data?.public_metadata?.projectId;
    const email = data?.email_address;

    if (!clerkInvitationId || !projectId || !email) return null;

    const existing = await projectInvitationRepository.findByClerkInvitationId(clerkInvitationId);
    if (existing) return existing;

    const role = data?.public_metadata?.role || MEMBERSHIP_ROLE.ADMIN;
    const expiresAt = data?.expires_at
      ? new Date(data.expires_at)
      : new Date(Date.now() + INVITATION_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
    return await projectInvitationRepository.create({
      project: projectId,
      email: email.toLowerCase(),
      clerkInvitationId,
      role,
      status: INVITATION_STATUS.PENDING,
      expiresAt,
    });
  }

  /**
   * Mirrors a Clerk-side revoke (e.g. from the Clerk dashboard) into the
   * local row. No-op unless the invitation is currently pending.
   */
  async handleInvitationRevoked(data) {
    const invitation = await projectInvitationRepository.findByClerkInvitationId(data?.id);
    if (!invitation || invitation.status !== INVITATION_STATUS.PENDING) return null;
    return await projectInvitationRepository.markRevoked(invitation._id);
  }

  /**
   * Handles Clerk's invitation.accepted webhook. Resolves the invitation by
   * Clerk id (falling back to project+email from public_metadata), finds the
   * new Persona user by email, and grants the Admin membership. Best-effort:
   * if the local user row hasn't landed yet (webhook ordering), it skips —
   * the user.created fallback (resolvePendingForEmail) covers that case.
   */
  async handleInvitationAccepted(data) {
    const email = data?.email_address;
    const projectId = data?.public_metadata?.projectId;
    const clerkInvitationId = data?.id;

    if (!email || !projectId || !clerkInvitationId) {
      logger.warn('invitation.accepted payload missing fields', { clerkInvitationId });
      return null;
    }

    let invitation = await projectInvitationRepository.findByClerkInvitationId(clerkInvitationId);
    if (!invitation) {
      invitation = await projectInvitationRepository.findPendingByProjectAndEmail(
        projectId,
        email.toLowerCase()
      );
    }
    if (!invitation) {
      logger.warn('invitation.accepted for unknown invitation', { clerkInvitationId });
      return null;
    }

    // Defense in depth: a revoked or expired Clerk invitation can't be
    // accepted server-side — treat a late/errant delivery as a no-op.
    if (invitation.status !== INVITATION_STATUS.PENDING) {
      logger.warn('invitation.accepted for non-pending invitation', {
        clerkInvitationId,
        status: invitation.status,
      });
      return null;
    }

    let user;
    try {
      user = await userRepository.findByEmail(email.toLowerCase());
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      logger.warn('invitation.accepted before local user exists, deferring', { email });
      return null;
    }

    return await this.grantMembershipFromInvitation(invitation, user._id, email);
  }

  /**
   * Fallback path (webhook ordering / missed events): an invited email signs
   * up, so every pending invitation for that email is granted. Best-effort —
   * per-invitation failures are logged and never rethrown.
   */
  async resolvePendingForEmail(email, personaUserId) {
    if (!email || !personaUserId) return;

    const pending = await projectInvitationRepository.findPendingByEmail(email.toLowerCase());
    for (const invitation of pending) {
      try {
        await this.grantMembershipFromInvitation(invitation, personaUserId, email.toLowerCase());
      } catch (error) {
        logger.warn('failed to resolve pending invitation on signup', {
          invitationId: invitation._id,
          error: error.message,
        });
      }
    }
  }

  /**
   * Shared grant step: create the Admin membership if it doesn't already
   * exist, mark the invitation accepted, and audit it. Idempotent — an
   * existing membership (e.g. the invitee was added directly meanwhile)
   * still accepts the invitation.
   */
  async grantMembershipFromInvitation(invitation, personaUserId, email) {
    const existing = await projectMembershipRepository.findByProjectAndUser(
      invitation.project,
      personaUserId
    );
    if (!existing) {
      try {
        await projectMembershipService.addMember(
          invitation.project,
          personaUserId,
          MEMBERSHIP_ROLE.ADMIN,
          personaUserId
        );
      } catch (error) {
        // Idempotency under webhook redelivery / dual-path races: if another
        // delivery (or the user.created fallback) just created the
        // membership, treat that as success rather than failing the webhook.
        if (!(error instanceof ValidationError) || !error.message.includes('already a member')) {
          throw error;
        }
      }
    }

    const accepted = await projectInvitationRepository.markAccepted(invitation._id, personaUserId);

    await auditLogService.record({
      eventType: 'invitation.accepted',
      actorContextType: 'ProjectAdmin',
      actorIdentity: personaUserId,
      targetDomain: invitation.project,
      targetResourceId: invitation._id,
      metadata: { email, role: invitation.role },
    });

    return accepted;
  }
}

export default new ProjectInvitationService();
