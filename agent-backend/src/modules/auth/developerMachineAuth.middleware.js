import projectCredentialService from '../projects/projectCredential.service.js';
import projectService from '../projects/project.service.js';
import { PROJECT_STATUS } from '../projects/project.model.js';
import externalUserService from '../externalUsers/externalUser.service.js';
import {
  createProjectMachineContext,
  createProjectRuntimeContext,
} from './projectPrincipalContext.js';
import BaseError from '../../utils/errors/BaseError.js';

/**
 * Developer API machine authentication (AD-01, AD-02, AD-07 §8, AD-08 §25).
 *
 * Parses a Project credential from the Authorization header, verifies it
 * (`projectCredentialService.verifyCredential`), checks the Project's
 * status, and attaches either a `ProjectMachineContext` or (when an
 * external user is asserted) a `ProjectRuntimeContext` to
 * `req.projectContext`. Raw headers/credentials never reach anything
 * downstream of this middleware — only the constructed context object
 * does (AD-07 §8's "downstream code must always know which context type
 * it received").
 *
 * Validation order follows the master implementation blueprint §8
 * precisely: credential validity → Project status → external-user
 * resolution — checking Project status only after the credential itself
 * is proven valid avoids doing further work for an unauthenticated
 * caller, and avoids revealing anything about feature availability
 * before authentication succeeds.
 *
 * WIRE FORMAT — an implementation-phase decision (AD-01 §17 explicitly
 * left this open; decided here): the credential is presented as a single
 * bearer token shaped `<keyId>.<secret>`, split on the first `.`. `keyId`
 * is safe to log; `secret` never is, and is never logged by this module.
 *
 * EXTERNAL USER HANDLING (AD-02 §11.1, unblocked by PR-6's ExternalUser
 * module): when the `x-persona-external-user-id` header is present on an
 * otherwise validly-authenticated request, the raw asserted id is
 * resolved-or-created via `externalUserService.resolveOrCreate` (a JIT
 * upsert scoped to this Project), then `ProjectRuntimeContext` is built
 * from the header's raw string — never from the resolved record's
 * internal `_id`. The resolve call exists to anchor/track the external
 * user for future resource-ownership references; it is not part of the
 * trust chain, which is "the Project's own credential asserts this id"
 * (AD-02 §14).
 *
 * SCOPE, still deliberately narrowed:
 *   - `ProjectAdminContext` (Clerk session + verified ProjectMembership)
 *     is not built here — that's projectAdminAuth.middleware.js, a
 *     separate, Clerk-authenticated chain for the admin control plane
 *     (project.routes.js). This module is the runtime/machine-auth chain
 *     only, never blended with Clerk auth on the same route (AD-01 §13).
 *
 * Mounted at /api/v1/developer (developer.routes.js, blueprint Phase 8,
 * PR-20) — see the master implementation blueprint §8, §20, §34 Phase 8.
 */

const EXTERNAL_USER_HEADER = 'x-persona-external-user-id';

/**
 * @param {string|undefined} authorizationHeader
 * @returns {{keyId: string, secret: string} | null}
 */
export function parseProjectCredential(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  const separatorIndex = token.indexOf('.');

  // Reject empty keyId, empty secret, or no separator at all — all of
  // these are malformed, not "valid but wrong".
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return null;
  }

  return {
    keyId: token.slice(0, separatorIndex),
    secret: token.slice(separatorIndex + 1),
  };
}

export default async function developerMachineAuthMiddleware(req, res, next) {
  try {
    const credential = parseProjectCredential(req.headers.authorization);
    if (!credential) {
      throw new BaseError('A valid Project credential is required', 401, 'UNAUTHORIZED');
    }

    const verified = await projectCredentialService.verifyCredential(
      credential.keyId,
      credential.secret
    );
    if (!verified) {
      throw new BaseError('Invalid Project credential', 401, 'UNAUTHORIZED');
    }

    const project = await projectService.getProjectById(verified.project);
    if (project.status !== PROJECT_STATUS.ACTIVE) {
      throw new BaseError('This Project is not currently active', 403, 'PROJECT_NOT_ACTIVE');
    }

    const domain = String(verified.project);
    const credentialId = String(verified.credentialId);
    const externalUserId = req.headers[EXTERNAL_USER_HEADER];

    if (externalUserId) {
      await externalUserService.resolveOrCreate(domain, externalUserId);
      req.projectContext = createProjectRuntimeContext({ domain, credentialId, externalUserId });
    } else {
      req.projectContext = createProjectMachineContext({ domain, credentialId });
    }

    next();
  } catch (error) {
    next(error);
  }
}
