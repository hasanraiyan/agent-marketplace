import mongoose from 'mongoose';
import { MEMBERSHIP_ROLE } from './projectMembership.model.js';

export const INVITATION_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

/**
 * ProjectInvitation (Developer Platform, AD-08 §11 — the previously-deferred
 * invitation workflow for someone without a Persona account yet).
 *
 * The invitation itself lives in Clerk (clerkClient.invitations.createInvitation),
 * which owns email delivery and the accept/sign-up flow. This row maps the
 * Clerk invitation back to the Project so the `invitation.accepted` webhook
 * (and a `user.created` fallback) can auto-grant an Admin membership.
 *
 * `clerkInvitationId` is unique; at most one *pending* invitation may exist
 * per (project, email) — re-inviting after an accept/revoke creates a fresh
 * row because the old one is no longer pending.
 */
const projectInvitationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    clerkInvitationId: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: Object.values(MEMBERSHIP_ROLE),
      default: MEMBERSHIP_ROLE.ADMIN,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(INVITATION_STATUS),
      default: INVITATION_STATUS.PENDING,
      required: true,
      index: true,
    },
    // Mirror of Clerk's expiry (expiresInDays). Clerk fires no webhook on
    // expiry, so listInvitations lazily flips past-due pending rows to
    // 'expired' (see projectInvitation.service.js).
    expiresAt: {
      type: Date,
      required: true,
    },
    // Optional so an orphan-backfilled row (invitation.created webhook after
    // a crashed create) can exist without knowing the original inviter.
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    acceptedAt: {
      type: Date,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

projectInvitationSchema.index(
  { project: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

const ProjectInvitation = mongoose.model('ProjectInvitation', projectInvitationSchema);

export default ProjectInvitation;
