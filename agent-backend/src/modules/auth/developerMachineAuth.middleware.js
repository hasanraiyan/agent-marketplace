import projectCredentialService from '../projects/projectCredential.service.js';
import projectService from '../projects/project.service.js';
import { PROJECT_STATUS } from '../projects/project.model.js';
import { createProjectMachineContext } from './projectPrincipalContext.js';
import BaseError from '../../utils/errors/BaseError.js';

/**
 * Developer API machine authentication (AD-01, AD-07 §8, AD-08 §25).
 *
 * Parses a Project credential from the Authorization header, verifies it
 * (`projectCredentialService.verifyCredential`), checks the Project's
 * status, and attaches a `ProjectMachineContext` to `req.projectContext`.
 * Raw headers/credentials never reach anything downstream of this
 * middleware — only the constructed context object does (AD-07 §8's
 * "downstream code must always know which context type it received").
 *
 * Validation order follows the master implementation blueprint §8
 * precisely: credential validity → Project status → (external-user
 * handling, see SCOPE below) — checking Project status only after the
 * credential itself is proven valid avoids doing further work for an
 * unauthenticated caller, and avoids revealing anything about
 * feature availability before authentication succeeds.
 *
 * WIRE FORMAT — an implementation-phase decision (AD-01 §17 explicitly
 * left this open; decided here): the credential is presented as a single
 * bearer token shaped `<keyId>.<secret>`, split on the first `.`. `keyId`
 * is safe to log; `secret` never is, and is never logged by this module.
 *
 * SCOPE, deliberately narrowed from the originally-recommended
 * "Developer auth middleware" (see this PR's own description for the
 * reasoning):
 *   - Constructs ONLY `ProjectMachineContext` in this PR.
 *   - `ProjectRuntimeContext` (an externalUserId header layered on top,
 *     AD-02) is explicitly NOT handled yet — it requires the
 *     ExternalUser/Subject module (blueprint Phase 5), which does not
 *     exist yet. If the externalUserId header is present on an otherwise
 *     validly-authenticated request, this middleware rejects rather than
 *     silently ignoring the header and treating the call as if no
 *     external user had been asserted — a silent downgrade would be a
 *     real, security-relevant behavior change the caller didn't ask for.
 *   - `ProjectAdminContext` (Clerk session + verified ProjectMembership)
 *     is also not built here — it needs a settled convention for which
 *     Project a given request targets, which depends on the Developer
 *     API route design (blueprint Phase 9), not yet decided.
 *
 * Not mounted on any route in this PR — see the master implementation
 * blueprint §8, §34 Phase 2/9.
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

    if (req.headers[EXTERNAL_USER_HEADER]) {
      throw new BaseError(
        'External user assertion is not yet supported by this Developer API deployment',
        501,
        'NOT_IMPLEMENTED'
      );
    }

    req.projectContext = createProjectMachineContext({
      domain: String(verified.project),
      credentialId: String(verified.credentialId),
    });

    next();
  } catch (error) {
    next(error);
  }
}
