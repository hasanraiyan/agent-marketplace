import projectMembershipRepository from '../projects/projectMembership.repository.js';
import { createProjectAdminContext } from './projectPrincipalContext.js';
import BaseError from '../../utils/errors/BaseError.js';

/**
 * Resolves `ProjectAdminContext` from an already Clerk-authenticated
 * request (must run after `authMiddleware`, which sets `req.user`) plus a
 * `:projectId` route param, by looking up the caller's own
 * ProjectMembership row (blueprint Phase 8, PR-19 — the "settled
 * convention for which Project a given request targets" that
 * developerMachineAuth.middleware.js's own doc comment flagged as the
 * blocker for building this).
 *
 * Existence-hiding (AD-07 §29, the same convention used throughout this
 * codebase for agents/threads): a nonexistent Project and a Project the
 * caller simply isn't a member of both resolve to the same 404 — never a
 * distinguishable 403, so this endpoint cannot be used to enumerate which
 * Project IDs exist.
 *
 * Deliberately does not check Project `status` — administrative authority
 * (view/manage membership and credentials) is independent of whether the
 * Project is currently ACTIVE; only runtime execution is gated on status
 * (developerMachineAuth.middleware.js), not admin CRUD.
 */
export default async function projectAdminAuthMiddleware(req, res, next) {
  try {
    const projectId = req.params.projectId;
    const personaUserId = req.user?._id ?? req.user?.id;

    if (!projectId || !personaUserId) {
      throw new BaseError('Authentication required', 401, 'UNAUTHORIZED');
    }

    let membership;
    try {
      membership = await projectMembershipRepository.findByProjectAndUser(projectId, personaUserId);
    } catch {
      // A malformed :projectId (bad ObjectId format) is just another shape
      // of "not found" — same existence-hiding posture as a real mismatch.
      membership = null;
    }

    if (!membership) {
      throw new BaseError('Project not found', 404, 'NOT_FOUND');
    }

    req.projectAdminContext = createProjectAdminContext({
      domain: projectId,
      personaUserId,
      membershipRole: membership.role,
    });

    next();
  } catch (error) {
    next(error);
  }
}
