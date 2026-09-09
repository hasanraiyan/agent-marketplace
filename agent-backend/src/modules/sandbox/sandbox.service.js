import { CodeSandbox } from '@codesandbox/sdk';
import AgentSandbox from './agentSandbox.model.js';
import { CodeSandboxBackend } from './codesandbox.backend.js';
import projectSecretService from '../projects/projectSecret.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Resolves the CodeSandbox-backed root filesystem/execution backend for an
 * agent, or `null` if the agent shouldn't get one (missing secret,
 * provisioning failure). Callers treat `null` as "fall back to the normal
 * virtual filesystem" — this never throws, mirroring `getSearchTool()`'s
 * fail-open shape for a missing `TAVILY_API_KEY`.
 *
 * One CodeSandbox VM is reused per `${agentId}:${userId}` — the same
 * granularity `agent.factory.js` already caches compiled agent instances at
 * (`effectiveCacheKey`) — not a new VM per message. CodeSandbox's
 * `create()` assigns its own sandbox id (there's no "create with a name I
 * choose"), so the id is persisted in `AgentSandbox` and resumed next time
 * via `sandboxes.resume()`.
 */
export async function getSandboxBackend({ agentId, userId, domain }) {
  const apiKey = await projectSecretService.resolveSecretByLabel(domain, 'CSB_API_KEY');
  if (!apiKey) {
    logger.warn('[SandboxService] CSB_API_KEY project secret not found; sandbox disabled', {
      agentId,
      domain,
    });
    return null;
  }

  const key = `${agentId}:${userId}`;

  try {
    const client = new CodeSandbox(apiKey);
    const existing = await AgentSandbox.findOne({ key });

    let sandbox;
    if (existing) {
      try {
        sandbox = await client.sandboxes.resume(existing.codesandboxId);
      } catch (err) {
        logger.warn('[SandboxService] failed to resume sandbox, creating a new one', {
          agentId,
          codesandboxId: existing.codesandboxId,
          error: err.message,
        });
        sandbox = null;
      }
    }

    if (!sandbox) {
      sandbox = await client.sandboxes.create({
        privacy: 'private',
        title: `agent:${agentId} user:${userId}`,
      });
      await AgentSandbox.findOneAndUpdate(
        { key },
        { key, agent: agentId, codesandboxId: sandbox.id },
        { upsert: true }
      );
    }

    const sandboxClient = await sandbox.connect();
    return new CodeSandboxBackend(sandboxClient);
  } catch (err) {
    logger.error('[SandboxService] failed to provision sandbox backend', {
      agentId,
      domain,
      error: err.message,
    });
    return null;
  }
}
