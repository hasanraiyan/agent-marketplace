import projectMembershipRepository from './projectMembership.repository.js';
import { MEMBERSHIP_ROLE } from './projectMembership.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';

class ProjectMembershipService {
  /**
   * Adds a Persona User as a Project Admin. v1 supports exactly one role,
   * 'Admin' (AD-08 §9) — the schema's own enum rejects anything else.
   * v1's minimum mechanism is directly adding an existing Persona User; a
   * pending-invitation workflow for users without an account yet is
   * explicitly deferred (AD-08 §11).
   */
  async addMember(projectId, personaUserId, role = MEMBERSHIP_ROLE.ADMIN) {
    return await projectMembershipRepository.create({ project: projectId, personaUserId, role });
  }

  /**
   * Removes a Project member, enforcing AD-08 §12's last-Admin invariant:
   * an ACTIVE Project must always retain >=1 Admin. Covers both voluntary
   * self-removal ("leave Project") and one Admin removing another — both
   * call this same method.
   *
   * Correctness note: the invariant only applies when the membership
   * being removed is itself an Admin AND removing it would bring the
   * Project's admin count to zero — not merely "the project currently has
   * only one admin somewhere." Removing a non-admin, or removing one of
   * several admins, is always allowed.
   *
   * KNOWN LIMITATION, accepted for v1 and now wired to
   * `DELETE /api/v1/projects/:projectId/members/:personaUserId` (blueprint
   * §42): this is a check-then-act sequence (read membership, count
   * admins, then delete), not a single atomic operation. Under concurrent
   * removal requests there is a theoretical race window where two
   * simultaneous removals could both pass the count check and jointly
   * bring the Project to zero Admins. Given this codebase has no
   * transaction infrastructure and Projects realistically have a handful
   * of Admins performing infrequent membership changes, true atomicity
   * (a Mongo transaction, or a single-collection conditional update) is
   * deferred rather than blocking this endpoint — revisit if concurrent
   * membership management ever becomes a real usage pattern.
   */
  async removeMember(projectId, personaUserId) {
    const membership = await projectMembershipRepository.findByProjectAndUser(
      projectId,
      personaUserId
    );

    if (!membership) {
      throw new NotFoundError('Project membership not found', 'ProjectMembership');
    }

    if (membership.role === MEMBERSHIP_ROLE.ADMIN) {
      const adminCount = await projectMembershipRepository.countAdminsByProject(projectId);

      if (adminCount <= 1) {
        throw new ValidationError(
          'Cannot remove the last remaining Admin of a Project — every ACTIVE Project must ' +
            'retain at least one Admin (AD-08 §12)'
        );
      }
    }

    await projectMembershipRepository.delete(projectId, personaUserId);
    return membership;
  }

  async listMembers(projectId) {
    return await projectMembershipRepository.findByProject(projectId);
  }
}

export default new ProjectMembershipService();
