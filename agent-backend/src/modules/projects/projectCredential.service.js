import projectCredentialRepository from './projectCredential.repository.js';
import credentialSecret from '../../utils/credentialSecret.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import auditLogService from '../audit/auditLog.service.js';

/**
 * ProjectCredential service — AD-01 (key-ID + hashed-secret lifecycle) and
 * AD-08 §17 (the critical credential-creation-authority refinement).
 *
 * Every method that returns a credential to a caller strips `secretHash`
 * (see `_formatCredential`) — the ONE exception is `createCredential`,
 * which returns the freshly-generated plaintext `secret` exactly once,
 * never `secretHash`, and never again after this call returns (AD-01
 * §9.2).
 */
class ProjectCredentialService {
  _formatCredential(credential) {
    if (!credential) return null;
    return {
      id: credential._id,
      project: credential.project,
      keyId: credential.keyId,
      label: credential.label,
      status: credential.status,
      createdBy: credential.createdBy,
      lastUsedAt: credential.lastUsedAt,
      revokedAt: credential.revokedAt,
      createdAt: credential.createdAt,
    };
  }

  /**
   * Creates a new Project credential. **Requires `ProjectAdminContext`
   * only** — this is AD-08 §17's central finding: a machine credential
   * must never be able to mint another credential (including for its own
   * "rotation"), because a leaked machine credential that could do so
   * would let an attacker persist past the original credential's
   * revocation. `projectId` is taken from the trusted `adminContext.domain`
   * — never a separately-passed value that could be spoofed to create a
   * credential for a different Project than the one the admin actually
   * has membership authority over.
   *
   * Returns the plaintext `secret` exactly once. It is never stored and
   * cannot be retrieved again — only `secretHash` is persisted.
   */
  async createCredential(adminContext, { label } = {}) {
    if (adminContext?.principalType !== 'ProjectAdmin') {
      throw new ValidationError(
        'Only ProjectAdminContext may create a Project credential (AD-08 §17) — a machine ' +
          'credential can never mint another credential, including for its own rotation'
      );
    }

    const keyId = credentialSecret.generateKeyId();
    const secret = credentialSecret.generateSecret();
    const secretHash = credentialSecret.hashSecret(secret);

    const credential = await projectCredentialRepository.create({
      project: adminContext.domain,
      keyId,
      secretHash,
      label: label || '',
      createdBy: adminContext.personaUserId,
    });

    await auditLogService.record({
      eventType: 'credential.created',
      actorContextType: 'ProjectAdmin',
      actorIdentity: adminContext.personaUserId,
      targetDomain: adminContext.domain,
      targetResourceId: credential._id,
      metadata: { keyId, label: label || '' },
    });

    return {
      ...this._formatCredential(credential),
      secret, // shown once — the only response that will ever include it
    };
  }

  /**
   * Revokes a Project credential. `ProjectAdminContext` may revoke any
   * credential belonging to its own Project. A `ProjectMachineContext`
   * may revoke **only itself** — a strictly capability-*reducing*
   * operation, safe for self-service (AD-08 §17): the worst case of an
   * attacker also self-revoking a stolen credential is that legitimate
   * service goes down, not that the attacker gains anything. A machine
   * credential revoking a *different* credential is refused — that would
   * let a compromised credential sabotage every other legitimate
   * credential while the attacker's own stolen one remains valid.
   */
  async revokeCredential(context, credentialId) {
    const isAdmin = context?.principalType === 'ProjectAdmin';
    const isSelfRevoke =
      context?.principalType === 'ProjectMachine' &&
      String(context?.credentialId) === String(credentialId);

    if (!isAdmin && !isSelfRevoke) {
      throw new ValidationError(
        'Only ProjectAdminContext may revoke a Project credential — a ProjectMachineContext ' +
          'may only revoke itself, never a different credential (AD-08 §17)'
      );
    }

    const existing = await projectCredentialRepository.findByProjectAndId(
      context.domain,
      credentialId
    );
    if (!existing) {
      throw new NotFoundError('Project credential not found', 'ProjectCredential');
    }

    const revoked = await projectCredentialRepository.revoke(credentialId);
    if (!revoked) {
      // findByProjectAndId found it, but revoke() no-ops on an already-
      // REVOKED credential (atomic ACTIVE-only guard) — not an error,
      // revocation is idempotent from the caller's point of view.
      return this._formatCredential(existing);
    }

    await auditLogService.record({
      eventType: 'credential.revoked',
      actorContextType: context.principalType,
      // A self-revoking ProjectMachineContext has no personaUserId — its
      // own credentialId IS the actor identity in that case.
      actorIdentity: isAdmin ? context.personaUserId : context.credentialId,
      targetDomain: context.domain,
      targetResourceId: credentialId,
    });

    return this._formatCredential(revoked);
  }

  /**
   * Lists a Project's credentials — metadata only, for any Project
   * principal (`ProjectAdminContext` or `ProjectMachineContext`); reading
   * "which credentials exist and their status" is routine, unlike
   * creating or revoking one (AD-08 §34's authority matrix).
   */
  async listCredentials(context) {
    const credentials = await projectCredentialRepository.findByProject(context.domain);
    return credentials.map((c) => this._formatCredential(c));
  }

  /**
   * Verifies a presented (keyId, secret) pair and returns the matching
   * credential's project scope on success. This is the piece a future
   * Developer auth middleware will call to construct a
   * `ProjectMachineContext` — not wired to any request path yet.
   *
   * Fails closed uniformly: unknown keyId, revoked credential, and wrong
   * secret all return `null` via the same path, so a caller cannot
   * distinguish "no such key" from "wrong secret" (avoiding a credential-
   * enumeration oracle, AD-01 §12.5).
   */
  async verifyCredential(keyId, presentedSecret) {
    const credential = await projectCredentialRepository.findByKeyId(keyId);

    if (!credential || credential.status !== 'ACTIVE') {
      return null;
    }

    const isValid = credentialSecret.verifySecret(presentedSecret, credential.secretHash);
    if (!isValid) {
      return null;
    }

    await projectCredentialRepository.touchLastUsedAt(credential._id);

    return {
      credentialId: credential._id,
      project: credential.project,
    };
  }
}

export default new ProjectCredentialService();
