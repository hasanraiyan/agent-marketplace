import type { CreateRuntimeOptions, Runtime } from './types/options.js';
import type { RuntimeRequest } from './types/request.js';
import type { RuntimeResponse } from './types/response.js';
import { matchRoute, stripMountPath, type Route } from './routing.js';
import { createClientForRequest } from './client-factory.js';
import { errorToResponse, RuntimeHttpError } from './errors.js';
import type { RunDriver } from './runDriver.js';
import { evictStaleRuns, DEFAULT_RUN_GRACE_MS, DEFAULT_MAX_TRACKED_RUNS } from './runRegistry.js';
import { healthRoute } from './routes/health.js';
import { chatRoute } from './routes/chat.js';
import { resumeChatRoute } from './routes/chatResume.js';
import {
  listThreads,
  createThread,
  getThread,
  updateThread,
  deleteThread,
} from './routes/threads.js';
import { listAgents } from './routes/agents.js';
import { listFiles, uploadFile, downloadFile, deleteFile } from './routes/files.js';
import { listMemory, getMemoryFile, writeMemoryFile, deleteMemoryFile } from './routes/memory.js';
import {
  getOwnerAuthorizeUrl,
  getUserAuthorizeUrl,
  getUserConnectionStatus,
  disconnectUserConnection,
  disconnectOwnerConnection,
} from './routes/mcpOAuth.js';

function buildRoutes(): Route[] {
  return [
    { method: 'GET', pattern: ['health'], handler: healthRoute, requiresAuth: false },
    { method: 'POST', pattern: ['chat'], handler: chatRoute },
    { method: 'GET', pattern: ['chat', ':runId', 'resume'], handler: resumeChatRoute },
    { method: 'GET', pattern: ['threads'], handler: listThreads },
    { method: 'POST', pattern: ['threads'], handler: createThread },
    { method: 'GET', pattern: ['threads', ':id'], handler: getThread },
    { method: 'PATCH', pattern: ['threads', ':id'], handler: updateThread },
    { method: 'DELETE', pattern: ['threads', ':id'], handler: deleteThread },
    { method: 'GET', pattern: ['agents'], handler: listAgents },
    { method: 'GET', pattern: ['files'], handler: listFiles },
    { method: 'POST', pattern: ['files'], handler: uploadFile },
    { method: 'GET', pattern: ['files', ':id'], handler: downloadFile },
    { method: 'DELETE', pattern: ['files', ':id'], handler: deleteFile },
    { method: 'GET', pattern: ['memory'], handler: listMemory },
    { method: 'GET', pattern: ['memory', 'file'], handler: getMemoryFile },
    { method: 'PUT', pattern: ['memory', 'file'], handler: writeMemoryFile },
    { method: 'DELETE', pattern: ['memory', 'file'], handler: deleteMemoryFile },
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
}

function resolveMode(options: CreateRuntimeOptions): 'development' | 'production' {
  if (options.mode) return options.mode;
  return process.env.NODE_ENV === 'development' ? 'development' : 'production';
}

export function createRuntime(options: CreateRuntimeOptions): Runtime {
  if (!options.baseUrl) throw new Error('createRuntime: "baseUrl" is required');
  if (!options.credential) throw new Error('createRuntime: "credential" is required');
  if (!options.resolveUser) throw new Error('createRuntime: "resolveUser" is required');

  const routes = buildRoutes();
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
