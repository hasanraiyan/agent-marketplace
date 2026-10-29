import { CodeSandbox } from '@codesandbox/sdk';
import { LocalShellBackend } from 'deepagents';
import AgentSandbox from './agentSandbox.model.js';
import { CodeSandboxBackend } from './codesandbox.backend.js';
import projectSecretService from '../projects/projectSecret.service.js';
import { loggerService } from '../../utils/index.js';
import path from 'node:path';
import fs from 'node:fs';

const logger = loggerService.getLogger();

/**
 * Whether a *local* (host-process) sandbox is permitted. This is ONLY for
 * local development / debug runs — it executes real shell commands on the
 * machine running the backend, with no isolation. Never enable in production.
 */
export function isLocalSandboxAllowed() {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.ENABLE_LOCAL_SANDBOX === 'true' ||
    !!process.env.DEBUG
  );
}

/**
 * Resolves a local (host) shell backend for an agent. Used as a fallback when
 * no CSB_API_KEY Project Secret exists but local sandboxing is allowed (dev
 * mode). Returns null on failure — callers fall back to the virtual filesystem.
 */
async function getLocalSandboxBackend({ agentId, userId }) {
  if (!isLocalSandboxAllowed()) return null;

  const rootDir = path.join(
    process.cwd(),
    '.local-sandboxes',
    String(agentId),
    String(userId)
  );

  try {
    fs.mkdirSync(rootDir, { recursive: true });
    const backend = await LocalShellBackend.create({
      rootDir,
      virtualMode: true,
      inheritEnv: true,
      timeout: 120,
    });
    logger.warn(
      '[SandboxService] Using LOCAL (host) sandbox — dev/debug mode only, no isolation. Do NOT use in production.',
      { agentId, userId, rootDir }
    );
    return backend;
  } catch (err) {
    logger.error('[SandboxService] failed to provision local sandbox backend', {
      agentId,
      userId,
      error: err.message,
    });
    return null;
  }
}

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
 *
 * When no CSB_API_KEY is present but local sandboxing is allowed (dev/debug
 * mode), falls back to a LocalShellBackend so agents can still exercise real
 * shell execution without a paid CodeSandbox account.
 */
export async function getSandboxBackend({ agentId, userId, domain }) {
  const apiKey = await projectSecretService.resolveSecretByLabel(domain, 'CSB_API_KEY');
  if (!apiKey) {
    logger.warn('[SandboxService] CSB_API_KEY project secret not found; sandbox disabled', {
      agentId,
      domain,
    });
    // Dev/debug fallback: local host sandbox (no isolation) so the app can be
    // run locally without a paid CodeSandbox account.
    const local = await getLocalSandboxBackend({ agentId, userId });
    if (local) return local;
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



