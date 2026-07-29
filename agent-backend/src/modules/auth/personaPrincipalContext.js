/**
 * PersonaPrincipalContext (Developer Platform foundation, AD-03/AD-07).
 *
 * Persona is a fixed, first-party Domain — never a Project (AD-03). This
 * module wraps an authenticated Persona User (the Mongoose document
 * `authMiddleware` already attaches to `req.user`) into the same
 * request-context shape the Developer Platform's future context types
 * (ProjectMachineContext, ProjectRuntimeContext, ProjectAdminContext — not
 * introduced yet) will also use, so downstream Domain-aware code can
 * eventually consume either without caring which one it received.
 *
 * `personaUserId` is deliberately the internal Mongo `User._id` — verified
 * directly against `auth.middleware.js`/`auth.service.js`: `req.user` is the
 * full Mongoose User document (`{_id, clerkId, email, name, role, ...}`),
 * and every existing ownership field in the codebase (`agent.ownerId`,
 * `thread.userId`, etc.) references that same internal `_id`, never the
 * external `clerkId`. This wrapper must never substitute `clerkId` here.
 *
 * Foundation primitive only (Developer Platform PR-1). Not yet constructed
 * or consumed by any controller/service/middleware — see the master
 * implementation blueprint, §5 and §43. Do not add ProjectMachineContext,
 * ProjectRuntimeContext, ProjectAdminContext, or ExternalUser here; those
 * belong to later phases.
 */

/** Persona's fixed, first-party Domain identity (AD-03 §11). */
export const PERSONA_DOMAIN = 'persona';

/** Principal types recognized by Domain-aware context objects. Only one exists yet. */
export const PRINCIPAL_TYPE = Object.freeze({
  PERSONA_USER: 'PersonaUser',
});

/**
 * @param {*} user - The authenticated Persona User, as attached to `req.user`
 *   by the existing `authMiddleware` (a Mongoose `User` document, or any
 *   object exposing an `_id`/`id`).
 * @returns {{domain: string, principalType: string, personaUserId: *}} A
 *   frozen PersonaPrincipalContext.
 * @throws {Error} If `user` is missing or has no internal identifier.
 */
export function createPersonaPrincipalContext(user) {
  const personaUserId = user?._id ?? user?.id;

  if (!personaUserId) {
    throw new Error(
      'createPersonaPrincipalContext: an authenticated Persona User with an internal _id/id is required'
    );
  }

  return Object.freeze({
    domain: PERSONA_DOMAIN,
    principalType: PRINCIPAL_TYPE.PERSONA_USER,
    personaUserId,
  });
}

export default { PERSONA_DOMAIN, PRINCIPAL_TYPE, createPersonaPrincipalContext };
