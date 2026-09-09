import { createRuntime } from '@personaai/runtime';
import type { CreateRuntimeOptions, ResolveUser, Runtime } from '@personaai/runtime';
import { createLogger, type Logger, type LogLevel } from '@personaai/logger';
import { TranslationError, toRuntimeRequest } from './translate.js';
import type { NextRouteContext } from './translate.js';
import { toWebResponse } from '../shared/write-web.js';

export { toRuntimeRequest, toWebResponse, TranslationError };
export type { NextRouteContext };

export { createRuntime };
export type {
  CreateRuntimeOptions,
  ResolveUser,
  Runtime,
  RuntimeCapabilities,
  RuntimeHooks,
  RuntimeRequest,
  RuntimeResponse,
  RunContext,
  RunResult,
  ErrorContext,
  ToolCallContext,
  FileUploadContext,
  ThreadCreateContext,
  MemoryWriteContext,
  RestToolsManifestOptions,
  RestToolManifestEntry,
  RcpManifestOptions,
} from '@personaai/runtime';

export const VERSION = '0.1.0';

export type NextResolveUser = (req: Request) => string | null | Promise<string | null>;

export type NextRouteHandler = (req: Request, ctx?: NextRouteContext) => Promise<Response>;

export interface PersonaRouteHandlers {
  GET: NextRouteHandler;
  POST: NextRouteHandler;
  PUT: NextRouteHandler;
  PATCH: NextRouteHandler;
  DELETE: NextRouteHandler;
  runtime: Runtime;
}

export interface ToNextRouteHandlersOptions {
  resolveUserFrom?: NextResolveUser;
  logLevel?: LogLevel;
  logger?: Logger;
}

export function toNextRouteHandlers(
  runtime: Runtime,
  options: ToNextRouteHandlersOptions = {},
): PersonaRouteHandlers {
  const logger: Logger =
    options.logger ?? createLogger('adapter:nextjs', options.logLevel !== undefined ? { level: options.logLevel } : undefined);
  const routeLogger = logger.child('route');

  const handler: NextRouteHandler = async (req, ctx) => {
    const startMs = Date.now();
    logger.debug('nextjs handle start', { method: req.method, url: req.url });

    let request;
    try {
      request = await toRuntimeRequest(req, ctx, logger);
      logger.debug('toRuntimeRequest succeeded', { method: request.method, path: request.path });
    } catch (err) {
      if (err instanceof TranslationError) {
        logger.warn('translation failed', { error: err.message, url: req.url });
        return Response.json({ error: { code: 'INVALID_REQUEST', message: err.message } }, { status: 400 });
      }
      logger.error('translation error', { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }

    if (options.resolveUserFrom) {
      try {
        request.userId = await options.resolveUserFrom(req);
        logger.debug('resolveUserFrom succeeded', { userId: request.userId ?? null });
      } catch (err) {
        logger.warn('resolveUserFrom threw', { error: err instanceof Error ? err.message : String(err) });
        request.userId = null;
      }
    }

    const response = await runtime.handle(request);
    const durationMs = Date.now() - startMs;
    routeLogger.debug('runtime handle completed', {
      method: request.method,
      path: request.path,
      status: response.status,
      durationMs,
    });
    logger.info('nextjs handle completed', {
      method: request.method,
      path: request.path,
      status: response.status,
      durationMs,
    });
    return toWebResponse(response, logger);
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
    runtime,
  };
}

export interface CreatePersonaHandlerOptions extends Omit<CreateRuntimeOptions, 'resolveUser'> {
  resolveUser?: ResolveUser;
  resolveUserFrom?: NextResolveUser;
  logLevel?: LogLevel;
  logger?: Logger;
}

export function createPersonaHandler(options: CreatePersonaHandlerOptions): PersonaRouteHandlers {
  if (!options.resolveUser && !options.resolveUserFrom) {
    throw new Error('createPersonaHandler: either "resolveUser" or "resolveUserFrom" is required');
  }

  const logger: Logger =
    options.logger ?? createLogger('adapter:nextjs', options.logLevel !== undefined ? { level: options.logLevel } : undefined);
  logger.debug('createPersonaHandler', {
    hasResolveUser: !!options.resolveUser,
    hasResolveUserFrom: !!options.resolveUserFrom,
  });

  const runtime = createRuntime({
    ...(options as Omit<CreateRuntimeOptions, 'resolveUser'>),
    logger: logger.child('runtime'),
    resolveUser: options.resolveUserFrom ? (request) => request.userId ?? null : options.resolveUser!,
  } as CreateRuntimeOptions);

  logger.info('runtime created via createPersonaHandler', { hasResolveUserFrom: !!options.resolveUserFrom });
  return toNextRouteHandlers(runtime, { resolveUserFrom: options.resolveUserFrom, logger });
}
