import projectSecretRepository from './projectSecret.repository.js';
import restApiToolRepository from '../restApiTools/restApiTool.repository.js';
import encryption from '../../utils/encryption.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import auditLogService from '../audit/auditLog.service.js';

/**
 * ProjectSecret service — project-level secret management for the REST API
 * Tool Builder's Auth tab (PERSONA_REST_TOOL_REQUEST.md item 2): "a way for
 * our endpoint to verify the request actually came from Persona ... a
 * static shared-secret (Bearer token) configured once per tool".
 *
 * Unlike `projectCredential.service.js#createCredential` (AD-08 §17 —
 * creation restricted to ProjectAdminContext only, because a leaked
 * *credential* that could mint another credential is a persistence risk),
 * secret creation here is open to both ProjectAdminContext and
 * ProjectMachineContext, matching every other Project resource's authority
 * model (Mcp, Skill, etc. are all machine-creatable) — a leaked
 * ProjectMachine credential already has equivalent capability via those
 * paths, so restricting secrets specifically wouldn't close a materially
 * different hole.
 */
class ProjectSecretService {
  /**
   * Plaintext is never returned here, including immediately after creation
   * — the caller already typed the value in (unlike ProjectCredential's
   * server-generated "shown once" secret, which exists precisely because
   * the caller could otherwise never see it).
   */
  toSafeJson(secret) {
    if (!secret) return null;
    return {
      id: secret._id,
      project: secret.project,
      label: secret.label,
      hasValue: true,
      createdBy: secret.createdBy,
      lastUsedAt: secret.lastUsedAt,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    };
  }

  async createSecret(context, { label, value } = {}) {
    if (!label) throw new ValidationError('label is required');
    if (!value) throw new ValidationError('value is required');

    const valueEncrypted = encryption.encrypt(value);
    const secret = await projectSecretRepository.create({
      project: context.domain,
      label,
      valueEncrypted,
      createdBy: context.principalType === 'ProjectAdmin' ? context.personaUserId : null,
    });

    await auditLogService.record({
      eventType: 'secret.created',
      actorContextType: context.principalType,
      actorIdentity:
        context.principalType === 'ProjectAdmin' ? context.personaUserId : context.credentialId,
      targetDomain: context.domain,
      targetResourceId: secret._id,
      metadata: { label }, // never the value
    });

    return this.toSafeJson(secret);
  }

  async listSecrets(context) {
    const secrets = await projectSecretRepository.findByProject(context.domain);
    return secrets.map((s) => this.toSafeJson(s));
  }

  async getSecretById(context, id) {
    const secret = await projectSecretRepository.findByProjectAndId(context.domain, id);
    if (!secret) throw new NotFoundError('Project secret not found', 'ProjectSecret');
    return secret;
  }

  async updateSecret(context, id, { label, value } = {}) {
    await this.getSecretById(context, id);
    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (value !== undefined) updateData.valueEncrypted = encryption.encrypt(value);

    const secret = await projectSecretRepository.update(id, context.domain, updateData);

    await auditLogService.record({
      eventType: 'secret.updated',
      actorContextType: context.principalType,
      actorIdentity:
        context.principalType === 'ProjectAdmin' ? context.personaUserId : context.credentialId,
      targetDomain: context.domain,
      targetResourceId: secret._id,
      metadata: { label: secret.label, valueRotated: value !== undefined },
    });

    return this.toSafeJson(secret);
  }

  /** What's using this secret, before attempting to delete it — same shape as mcpService.getMcpUsage. */
  async getSecretUsage(context, id) {
    await this.getSecretById(context, id);
    const [restApiToolCount, restApiTools] = await Promise.all([
      restApiToolRepository.countUsingSecret(id),
      restApiToolRepository.findUsingSecret(id, '_id name', 20),
    ]);
    return { restApiToolCount, restApiTools };
  }

  /**
   * Blocks deletion while any RestApiTool still references this secret,
   * rather than cascading to `authType: 'none'` — a tool silently starting
   * to send unauthenticated requests to a developer's endpoint is a worse
   * failure mode than a blocked delete with a clear "used by N tools"
   * message.
   */
  async deleteSecret(context, id) {
    const usage = await this.getSecretUsage(context, id);
    if (usage.restApiToolCount > 0) {
      throw new ValidationError(
        `This secret is used by ${usage.restApiToolCount} REST tool(s). Remove it from those tools before deleting.`
      );
    }

    const secret = await projectSecretRepository.delete(id, context.domain);

    await auditLogService.record({
      eventType: 'secret.deleted',
      actorContextType: context.principalType,
      actorIdentity:
        context.principalType === 'ProjectAdmin' ? context.personaUserId : context.credentialId,
      targetDomain: context.domain,
      targetResourceId: id,
      metadata: { label: secret.label },
    });

    return this.toSafeJson(secret);
  }

  /**
   * Internal-only — never exposed via any controller. The one function the
   * RestApiTool executor calls to get a presentable plaintext secret value.
   * Deliberately takes just `secretId` (no context): the executor only
   * knows the tool's stored `secretRef`, not the original authoring
   * context, and ownership was already enforced at tool-save time
   * (`restApiTool.service.js` validates `secretRef` resolves inside the
   * same `context.domain` before it's ever persisted onto a tool).
   */
  async resolvePlaintext(secretId) {
    const secret = await projectSecretRepository.findById(secretId);
    if (!secret) throw new NotFoundError('Project secret not found', 'ProjectSecret');
    const value = encryption.decrypt(secret.valueEncrypted);
    projectSecretRepository.touchLastUsedAt(secret._id).catch(() => {});
    return value;
  }
}

export default new ProjectSecretService();
