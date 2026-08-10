import type { CreateRuntimeOptions, Runtime } from './types/options.js';
import type { RuntimeRequest } from './types/request.js';
import type { RuntimeResponse } from './types/response.js';
import { matchRoute, stripMountPath, type Route } from './routing.js';
import { createClientForRequest } from './client-factory.js';
import { errorToResponse, RuntimeHttpError } from './errors.js';
import { healthRoute } from './routes/health.js';
import { chatRoute } from './routes/chat.js';
import {
  listThreads,
  createThread,
  getThread,
  updateThread,
  deleteThread,
} from './routes/threads.js';
import { listAgents } from './routes/agents.js';

function buildRoutes(): Route[] {
  return [
    { method: 'GET', pattern: ['health'], handler: healthRoute, requiresAuth: false },
    { method: 'POST', pattern: ['chat'], handler: chatRoute },
    { method: 'GET', pattern: ['threads'], handler: listThreads },
    { method: 'POST', pattern: ['threads'], handler: createThread },
    { method: 'GET', pattern: ['threads', ':id'], handler: getThread },
    { method: 'PATCH', pattern: ['threads', ':id'], handler: updateThread },
    { method: 'DELETE', pattern: ['threads', ':id'], handler: deleteThread },
    { method: 'GET', pattern: ['agents'], handler: listAgents },
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
      });
    } catch (err) {
      return errorToResponse(err, mode);
    }
  }

  return { handle };
}
