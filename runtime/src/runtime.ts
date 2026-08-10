import type { CreateRuntimeOptions, Runtime, RuntimeCapabilities } from './types/options.js';
import type { RuntimeRequest } from './types/request.js';
import type { RuntimeResponse } from './types/response.js';
import { matchRoute, stripMountPath, type Route } from './routing.js';
import { createClientForRequest } from './client-factory.js';
import { errorToResponse, RuntimeHttpError } from './errors.js';
import type { RunDriver } from './runDriver.js';
import { evictStaleRuns, DEFAULT_RUN_GRACE_MS, DEFAULT_MAX_TRACKED_RUNS } from './runRegistry.js';
import { healthRoute } from './routes/health.js';
import { chatRoute } from './routes/chat.js';
import { architectRoute } from './routes/architect.js';
import { createResumeRoute } from './routes/resume.js';
import {
  listThreads,
  createThread,
  getThread,
  updateThread,
  deleteThread,
  bulkDeleteThreads,
  getThreadMessages,
} from './routes/threads.js';
import {
  listAgents,
  createAgent,
  getAgent,
  updateAgent,
  deleteAgent,
  bulkDeleteAgents,
} from './routes/agents.js';
import {
  listFiles,
  uploadFile,
  downloadFile,
  deleteFile,
  bulkDeleteFiles,
} from './routes/files.js';
import { listMemory, getMemoryFile, writeMemoryFile, deleteMemoryFile } from './routes/memory.js';
import {
  getOwnerAuthorizeUrl,
  getUserAuthorizeUrl,
  getUserConnectionStatus,
  disconnectUserConnection,
  disconnectOwnerConnection,
} from './routes/mcpOAuth.js';
import {
  listMcps,
  createMcp,
  getMcp,
  updateMcp,
  deleteMcp,
  bulkDeleteMcps,
  getMcpUsage,
  testMcpConnection,
  readMcpResource,
  callMcpTool,
} from './routes/mcps.js';
import {
  listProviders,
  createProvider,
  getProvider,
  updateProvider,
  deleteProvider,
  bulkDeleteProviders,
  testProviderConnection,
  getProviderModels,
  getProviderUsage,
} from './routes/providers.js';
import {
  listSkills,
  createSkill,
  getSkill,
  updateSkill,
  deleteSkill,
  bulkDeleteSkills,
  getSkillUsage,
} from './routes/skills.js';
import {
  listKnowledgeBases,
  createKnowledgeBase,
  getKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  bulkDeleteKnowledgeBases,
  getKnowledgeBaseUsage,
  uploadKnowledgeDocuments,
  listKnowledgeDocuments,
  deleteKnowledgeDocument,
  searchKnowledgeBase,
} from './routes/knowledge.js';
import {
  listStores,
  createStore,
  getStore,
  updateStore,
  deleteStore,
  listStoreFiles,
  getStoreFile,
  writeStoreFile,
  deleteStoreFile,
} from './routes/stores.js';
import { listAuditLogs } from './routes/auditLogs.js';

function resolveCapabilities(
  capabilities: RuntimeCapabilities | undefined
): Required<RuntimeCapabilities> {
  return {
    agentsWrite: capabilities?.agentsWrite ?? false,
    mcps: capabilities?.mcps ?? false,
    providers: capabilities?.providers ?? false,
    skills: capabilities?.skills ?? false,
    knowledge: capabilities?.knowledge ?? false,
    stores: capabilities?.stores ?? false,
    auditLogs: capabilities?.auditLogs ?? false,
    architect: capabilities?.architect ?? false,
  };
}

function buildRoutes(capabilities: Required<RuntimeCapabilities>): Route[] {
  const routes: Route[] = [
    { method: 'GET', pattern: ['health'], handler: healthRoute, requiresAuth: false },

    // Chat — always on, the core runtime feature.
    { method: 'POST', pattern: ['chat'], handler: chatRoute },
    { method: 'GET', pattern: ['chat', ':runId', 'resume'], handler: createResumeRoute('chat') },

    // Threads — always on, end-user-scoped conversation history.
    { method: 'GET', pattern: ['threads'], handler: listThreads },
    { method: 'POST', pattern: ['threads'], handler: createThread },
    { method: 'POST', pattern: ['threads', 'bulk-delete'], handler: bulkDeleteThreads },
    { method: 'GET', pattern: ['threads', ':id'], handler: getThread },
    { method: 'PATCH', pattern: ['threads', ':id'], handler: updateThread },
    { method: 'DELETE', pattern: ['threads', ':id'], handler: deleteThread },
    { method: 'GET', pattern: ['threads', ':id', 'messages'], handler: getThreadMessages },

    // Agents — read-only discovery always on; write ops behind agentsWrite.
    { method: 'GET', pattern: ['agents'], handler: listAgents },

    // Files — always on, end-user-scoped uploads.
    { method: 'GET', pattern: ['files'], handler: listFiles },
    { method: 'POST', pattern: ['files'], handler: uploadFile },
    { method: 'POST', pattern: ['files', 'bulk-delete'], handler: bulkDeleteFiles },
    { method: 'GET', pattern: ['files', ':id'], handler: downloadFile },
    { method: 'DELETE', pattern: ['files', ':id'], handler: deleteFile },

    // Memory — always on, end-user-scoped.
    { method: 'GET', pattern: ['memory'], handler: listMemory },
    { method: 'GET', pattern: ['memory', 'file'], handler: getMemoryFile },
    { method: 'PUT', pattern: ['memory', 'file'], handler: writeMemoryFile },
    { method: 'DELETE', pattern: ['memory', 'file'], handler: deleteMemoryFile },

    // MCP OAuth — always on, end-user connects their own account.
    {
      method: 'GET',
      pattern: ['mcps', ':id', 'oauth', 'owner', 'authorize'],
      handler: getOwnerAuthorizeUrl,
    },
    {
      method: 'GET',
      pattern: ['mcps', ':id', 'oauth', 'user', 'authorize'],
      handler: getUserAuthorizeUrl,
    },
    {
      method: 'GET',
      pattern: ['mcps', ':id', 'oauth', 'user', 'status'],
      handler: getUserConnectionStatus,
    },
    {
      method: 'DELETE',
      pattern: ['mcps', ':id', 'oauth', 'user', 'connection'],
      handler: disconnectUserConnection,
    },
    {
      method: 'DELETE',
      pattern: ['mcps', ':id', 'oauth', 'owner', 'connection'],
      handler: disconnectOwnerConnection,
    },
  ];

  if (capabilities.agentsWrite) {
    routes.push(
      { method: 'POST', pattern: ['agents'], handler: createAgent },
      { method: 'POST', pattern: ['agents', 'bulk-delete'], handler: bulkDeleteAgents },
      { method: 'GET', pattern: ['agents', ':id'], handler: getAgent },
      { method: 'PATCH', pattern: ['agents', ':id'], handler: updateAgent },
      { method: 'DELETE', pattern: ['agents', ':id'], handler: deleteAgent }
    );
  }

  if (capabilities.mcps) {
    routes.push(
      { method: 'GET', pattern: ['mcps'], handler: listMcps },
      { method: 'POST', pattern: ['mcps'], handler: createMcp },
      { method: 'POST', pattern: ['mcps', 'bulk-delete'], handler: bulkDeleteMcps },
      { method: 'GET', pattern: ['mcps', ':id'], handler: getMcp },
      { method: 'PATCH', pattern: ['mcps', ':id'], handler: updateMcp },
      { method: 'DELETE', pattern: ['mcps', ':id'], handler: deleteMcp },
      { method: 'GET', pattern: ['mcps', ':id', 'usage'], handler: getMcpUsage },
      { method: 'POST', pattern: ['mcps', ':id', 'test'], handler: testMcpConnection },
      { method: 'GET', pattern: ['mcps', ':id', 'resource'], handler: readMcpResource },
      { method: 'POST', pattern: ['mcps', ':id', 'call-tool'], handler: callMcpTool }
    );
  }

  if (capabilities.providers) {
    routes.push(
      { method: 'GET', pattern: ['providers'], handler: listProviders },
      { method: 'POST', pattern: ['providers'], handler: createProvider },
      { method: 'POST', pattern: ['providers', 'bulk-delete'], handler: bulkDeleteProviders },
      { method: 'GET', pattern: ['providers', ':id'], handler: getProvider },
      { method: 'PATCH', pattern: ['providers', ':id'], handler: updateProvider },
      { method: 'DELETE', pattern: ['providers', ':id'], handler: deleteProvider },
      { method: 'POST', pattern: ['providers', ':id', 'test'], handler: testProviderConnection },
      { method: 'GET', pattern: ['providers', ':id', 'models'], handler: getProviderModels },
      { method: 'GET', pattern: ['providers', ':id', 'usage'], handler: getProviderUsage }
    );
  }

  if (capabilities.skills) {
    routes.push(
      { method: 'GET', pattern: ['skills'], handler: listSkills },
      { method: 'POST', pattern: ['skills'], handler: createSkill },
      { method: 'POST', pattern: ['skills', 'bulk-delete'], handler: bulkDeleteSkills },
      { method: 'GET', pattern: ['skills', ':id'], handler: getSkill },
      { method: 'PATCH', pattern: ['skills', ':id'], handler: updateSkill },
      { method: 'DELETE', pattern: ['skills', ':id'], handler: deleteSkill },
      { method: 'GET', pattern: ['skills', ':id', 'usage'], handler: getSkillUsage }
    );
  }

  if (capabilities.knowledge) {
    routes.push(
      { method: 'GET', pattern: ['knowledge'], handler: listKnowledgeBases },
      { method: 'POST', pattern: ['knowledge'], handler: createKnowledgeBase },
      { method: 'POST', pattern: ['knowledge', 'bulk-delete'], handler: bulkDeleteKnowledgeBases },
      { method: 'GET', pattern: ['knowledge', ':id'], handler: getKnowledgeBase },
      { method: 'PATCH', pattern: ['knowledge', ':id'], handler: updateKnowledgeBase },
      { method: 'DELETE', pattern: ['knowledge', ':id'], handler: deleteKnowledgeBase },
      { method: 'GET', pattern: ['knowledge', ':id', 'usage'], handler: getKnowledgeBaseUsage },
      {
        method: 'POST',
        pattern: ['knowledge', ':id', 'documents'],
        handler: uploadKnowledgeDocuments,
      },
      {
        method: 'GET',
        pattern: ['knowledge', ':id', 'documents'],
        handler: listKnowledgeDocuments,
      },
      {
        method: 'DELETE',
        pattern: ['knowledge', ':id', 'documents', ':sourceName'],
        handler: deleteKnowledgeDocument,
      },
      { method: 'POST', pattern: ['knowledge', ':id', 'search'], handler: searchKnowledgeBase }
    );
  }

  if (capabilities.stores) {
    routes.push(
      { method: 'GET', pattern: ['stores'], handler: listStores },
      { method: 'POST', pattern: ['stores'], handler: createStore },
      { method: 'GET', pattern: ['stores', ':id'], handler: getStore },
      { method: 'PATCH', pattern: ['stores', ':id'], handler: updateStore },
      { method: 'DELETE', pattern: ['stores', ':id'], handler: deleteStore },
      { method: 'GET', pattern: ['stores', ':id', 'files'], handler: listStoreFiles },
      { method: 'GET', pattern: ['stores', ':id', 'file'], handler: getStoreFile },
      { method: 'PUT', pattern: ['stores', ':id', 'file'], handler: writeStoreFile },
      { method: 'DELETE', pattern: ['stores', ':id', 'file'], handler: deleteStoreFile }
    );
  }

  if (capabilities.auditLogs) {
    routes.push({ method: 'GET', pattern: ['audit-logs'], handler: listAuditLogs });
  }

  if (capabilities.architect) {
    routes.push(
      { method: 'POST', pattern: ['architect'], handler: architectRoute },
      {
        method: 'GET',
        pattern: ['architect', ':runId', 'resume'],
        handler: createResumeRoute('architect'),
      }
    );
  }

  return routes;
}

function resolveMode(options: CreateRuntimeOptions): 'development' | 'production' {
  if (options.mode) return options.mode;
  return process.env.NODE_ENV === 'development' ? 'development' : 'production';
}

export function createRuntime(options: CreateRuntimeOptions): Runtime {
  if (!options.baseUrl) throw new Error('createRuntime: "baseUrl" is required');
  if (!options.credential) throw new Error('createRuntime: "credential" is required');
  if (!options.resolveUser) throw new Error('createRuntime: "resolveUser" is required');

  const capabilities = resolveCapabilities(options.capabilities);
  const routes = buildRoutes(capabilities);
  const mode = resolveMode(options);
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;

  const runGraceMs = options.runGraceMs ?? DEFAULT_RUN_GRACE_MS;
  const maxTrackedRuns = options.maxTrackedRuns ?? DEFAULT_MAX_TRACKED_RUNS;

  const runs = new Map<string, RunDriver>();
  const evictionTimer = setInterval(
    () => evictStaleRuns(runs, Date.now(), runGraceMs, maxTrackedRuns),
    60_000
  );
  evictionTimer.unref?.();

  async function handle(request: RuntimeRequest): Promise<RuntimeResponse> {
    try {
      const path = stripMountPath(request.path, options.mountPath);
      const match = matchRoute(routes, request.method, path);

      if (match.kind === 'not-found') {
        throw new RuntimeHttpError(
          404,
          'NOT_FOUND',
          `No route for ${request.method} ${request.path}`
        );
      }
      if (match.kind === 'method-not-allowed') {
        const err = new RuntimeHttpError(
          405,
          'METHOD_NOT_ALLOWED',
          `${request.method} not allowed on ${request.path}. Allowed: ${match.allowed.join(', ')}.`
        );
        const response = errorToResponse(err, mode);
        return { ...response, headers: { ...response.headers, Allow: match.allowed.join(', ') } };
      }

      let userId: string | null = null;
      if (match.route.requiresAuth !== false) {
        try {
          userId = await options.resolveUser(request);
        } catch {
          userId = null;
        }
        if (userId === null) {
          throw new RuntimeHttpError(
            401,
            'UNAUTHORIZED',
            'Could not resolve an authenticated user for this request.'
          );
        }
      }

      const resolvedRequest: RuntimeRequest = { ...request, userId };
      const client = createClientForRequest(options, userId);

      return await match.route.handler(resolvedRequest, {
        client,
        hooks: options.hooks,
        mode,
        params: match.params,
        heartbeatIntervalMs,
        runs,
        capabilities,
      });
    } catch (err) {
      return errorToResponse(err, mode);
    }
  }

  return {
    handle,
    close() {
      clearInterval(evictionTimer);
    },
  };
}
