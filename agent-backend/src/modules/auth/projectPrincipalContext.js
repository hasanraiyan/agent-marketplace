/**
 * ProjectMachineContext / ProjectRuntimeContext / ProjectAdminContext
 * (Developer Platform foundation, AD-01 / AD-02 / AD-04 / AD-07 / AD-08).
 *
 * These are the three Project-side request-context shapes AD-07 §8
 * established, alongside PersonaPrincipalContext (personaPrincipalContext.js).
 * Downstream Domain-aware code must always know which of the four context
 * types it received — never infer identity from raw headers, and never
 * treat two structurally different contexts as interchangeable.
 *
 * Foundation primitives only (Developer Platform PR-2 — see the master
 * implementation blueprint §5, §8, §34 Phase 1). No Project,
 * ProjectCredential, or ProjectMembership model exists yet, so these
 * factories accept already-resolved, already-verified inputs — they do not
 * look anything up themselves, and nothing constructs them from a real
 * request yet. The Developer auth middleware that will actually build these
 * from a Project credential / externalUserId header / verified membership
 * lookup is deliberately deferred until those models exist (blueprint
 * Phase 2), so the credential- and membership-lookup logic isn't written
 * once against a throwaway stub and then rewritten.
 *
 * Each context is a plain, frozen object literal, matching
 * personaPrincipalContext.js's pattern exactly. The principal-type constant
 * below is intentionally scoped locally to this file rather than shared
 * with personaPrincipalContext.js's own PRINCIPAL_TYPE — this keeps this PR
 * purely additive (zero existing files modified). Consolidating principal-
 * type vocabulary into one shared registry is left for whichever later
 * change first needs to reason over all four principal types as a single
 * set (most likely the Developer auth middleware itself, in Phase 2).
 */

const PRINCIPAL_TYPE = Object.freeze({
  PROJECT_MACHINE: 'ProjectMachine',
  PROJECT_RUNTIME: 'ProjectRuntime',
  PROJECT_ADMIN: 'ProjectAdmin',
});

/** v1 supports exactly one Project membership role (AD-08 §9). */
const SUPPORTED_MEMBERSHIP_ROLES = Object.freeze(['Admin']);

function requireTruthy(value, fieldName, factoryName) {
  if (!value) {
    throw new Error(`${factoryName}: a truthy "${fieldName}" is required`);
  }
}

/**
 * AD-01: a Project backend authenticated with its Project credential,
 * asserting no external user — acting as the Project itself (e.g. a
 * Project-level System Agent call, AD-02 §13).
 *
 * @param {{domain: *, credentialId: *}} input
 * @returns {{domain: *, principalType: string, credentialId: *}}
 * @throws {Error} If `domain` or `credentialId` is falsy.
 */
export function createProjectMachineContext({ domain, credentialId } = {}) {
  requireTruthy(domain, 'domain', 'createProjectMachineContext');
  requireTruthy(credentialId, 'credentialId', 'createProjectMachineContext');

  return Object.freeze({
    domain,
    principalType: PRINCIPAL_TYPE.PROJECT_MACHINE,
    credentialId,
  });
}

/**
 * AD-01 credential + AD-02 externalUserId assertion — the Project backend
 * acting on behalf of one of its own external users.
 *
 * `externalUserId` is trusted-as-asserted-by-the-Project (AD-02 §14) — this
 * factory does not itself verify the assertion; it packages an input the
 * caller (the future Developer auth middleware) has already resolved from
 * an authenticated request. It never accepts or infers a `domain` from
 * anywhere other than the caller's own already-authenticated value.
 *
 * @param {{domain: *, credentialId: *, externalUserId: *}} input
 * @returns {{domain: *, principalType: string, credentialId: *, externalUserId: *}}
 * @throws {Error} If `domain`, `credentialId`, or `externalUserId` is falsy.
 */
export function createProjectRuntimeContext({ domain, credentialId, externalUserId } = {}) {
  requireTruthy(domain, 'domain', 'createProjectRuntimeContext');
  requireTruthy(credentialId, 'credentialId', 'createProjectRuntimeContext');
  requireTruthy(externalUserId, 'externalUserId', 'createProjectRuntimeContext');

  return Object.freeze({
    domain,
    principalType: PRINCIPAL_TYPE.PROJECT_RUNTIME,
    credentialId,
    externalUserId,
  });
}

/**
 * A Clerk-authenticated Persona User with verified Project membership
 * (AD-04 §6, AD-07 §8, AD-08 §9-10) — a human Project Admin. Never asserts
 * an externalUserId (AD-07 §8) — that trust chain belongs to
 * ProjectRuntimeContext alone, which is why this shape has no such field.
 *
 * `personaUserId` is the same internal Mongo `User._id` concept
 * personaPrincipalContext.js uses (AD-08 §10: Project membership attaches
 * to the internal Persona User identity, never the Clerk id).
 *
 * v1 supports exactly one membership role, `'Admin'` (AD-08 §9) — any other
 * value is rejected rather than silently accepted, since accepting an
 * unrecognized role here would indicate an upstream bug, not a legitimate
 * input.
 *
 * @param {{domain: *, personaUserId: *, membershipRole: string}} input
 * @returns {{domain: *, principalType: string, personaUserId: *, membershipRole: string}}
 * @throws {Error} If `domain`/`personaUserId` is falsy, or `membershipRole`
 *   is not one of the currently-supported roles.
 */
export function createProjectAdminContext({ domain, personaUserId, membershipRole } = {}) {
  requireTruthy(domain, 'domain', 'createProjectAdminContext');
  requireTruthy(personaUserId, 'personaUserId', 'createProjectAdminContext');

  if (!SUPPORTED_MEMBERSHIP_ROLES.includes(membershipRole)) {
    throw new Error(
      `createProjectAdminContext: unsupported membershipRole "${membershipRole}" — v1 only ` +
        `supports ${SUPPORTED_MEMBERSHIP_ROLES.join(', ')} (AD-08 §9)`
    );
  }

  return Object.freeze({
    domain,
    principalType: PRINCIPAL_TYPE.PROJECT_ADMIN,
    personaUserId,
    membershipRole,
  });
}

export default {
  createProjectMachineContext,
  createProjectRuntimeContext,
  createProjectAdminContext,
};
