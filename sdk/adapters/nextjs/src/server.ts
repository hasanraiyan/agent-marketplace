import { createRuntime } from '@personaai/runtime';
import type { CreateRuntimeOptions, ResolveUser, Runtime } from '@personaai/runtime';
import { createLogger, type Logger, type LogLevel } from '@personaai/logger';
import { TranslationError, toRuntimeRequest } from './translate.js';
import type { NextRouteContext } from './translate.js';
import { toWebResponse } from './write.js';

export { toRuntimeRequest, toWebResponse, TranslationError };
export type { NextRouteContext };

// Re-exported so a Next.js app never needs a direct `@personaai/runtime`
// install just to type its options or hooks — one package, per issue #232.
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
} from '@personaai/runtime';

/** Version of this package, kept in sync with `package.json`. */
export const VERSION = '0.1.10';

/**
 * Receives the raw Web `Request` and returns the resolved external user id,
 * or `null` (the runtime responds 401).
 *
 * Most Next.js auth libraries read the session from async context rather than
 * from the request, so this usually ignores its argument entirely:
 * `resolveUserFrom: async () => (await auth()).userId`.
 */
export type NextResolveUser = (req: Request) => string | null | Promise<string | null>;

/** A Next.js App Router route handler. */
export type NextRouteHandler = (req: Request, ctx?: NextRouteContext) => Promise<Response>;

/**
 * The object a route file destructures its method exports from. `runtime` is
 * also on it so `runtime.close()` stays reachable — but do **not** re-export
 * it from a route file, since Next.js treats a route-level `runtime` export
 * as the segment runtime config (`'nodejs'` / `'edge'`).
 */
export interface PersonaRouteHandlers {
  GET: NextRouteHandler;
  POST: NextRouteHandler;
  PUT: NextRouteHandler;
  PATCH: NextRouteHandler;
  DELETE: NextRouteHandler;
  runtime: Runtime;
}

export interface ToNextRouteHandlersOptions {
  /**
   * Resolves the user from the raw Web `Request`, after (or alongside) the
   * host's own auth. When omitted, the runtime's own `resolveUser` decides.
   */
  resolveUserFrom?: NextResolveUser;
  /** Log level for the Next.js adapter — off by default. */
  logLevel?: LogLevel;
  /** Custom logger instance — when provided, `logLevel` is ignored. */
  logger?: Logger;
}

/**
 * Core primitive — exposes an existing runtime as App Router route handlers.
 * Mirrors `toExpressRouter(runtime)` in `@personaai/express`.
 *
 * Use this directly when you need two runtimes (e.g. an end-user one and an
 * admin one with different `capabilities`) mounted at different routes;
 * otherwise reach for {@link createPersonaHandler}.
 */
export function toNextRouteHandlers(
  runtime: Runtime,
  options: ToNextRouteHandlersOptions = {}
): PersonaRouteHandlers {
  const logger: Logger =
    options.logger ?? createLogger('adapter:nextjs', options.logLevel !== undefined ? { level: options.logLevel } : undefined);
  const routeLogger = logger.child('route');

  const handler: NextRouteHandler = async (req, ctx) => {
    const startMs = Date.now();
    logger.debug('nextjs handle start', { method: req.method, url: req.url });
    logger.trace('nextjs request', { method: req.method, url: req.url });

    let request;
    try {
      request = await toRuntimeRequest(req, ctx, logger);
      logger.debug('toRuntimeRequest succeeded', { method: request.method, path: request.path });
    } catch (err) {
      if (err instanceof TranslationError) {
        logger.warn('translation failed', { error: err.message, url: req.url });
        return Response.json(
          { error: { code: 'INVALID_REQUEST', message: err.message } },
          { status: 400 }
        );
      }
      logger.error('translation error', { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }

    if (options.resolveUserFrom) {
      try {
        request.userId = await options.resolveUserFrom(req);
        logger.debug('resolveUserFrom succeeded', { userId: request.userId ?? null });
      } catch (err) {
        // Mirrors the runtime's own resolveUser contract: a throwing resolver
        // means "not authenticated" → the runtime responds 401.
        logger.warn('resolveUserFrom threw', { error: err instanceof Error ? err.message : String(err) });
        request.userId = null;
      }
    }

    // runtime.handle() never throws for HTTP errors — it returns a sanitized
    // error response instead, so there is nothing left to catch here.
    const response = await runtime.handle(request);
    const durationMs = Date.now() - startMs;
    routeLogger.debug('runtime handle completed', { method: request.method, path: request.path, status: response.status, durationMs });
    logger.info('nextjs handle completed', { method: request.method, path: request.path, status: response.status, durationMs });
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
  /**
   * Runtime-level user resolver — receives the translated request and returns
   * the external user id, or `null` → 401. Provide either this or
   * `resolveUserFrom`.
   */
  resolveUser?: ResolveUser;
  /**
   * Next.js-native user resolver: receives the Web `Request`, so it can call
   * your auth library directly. When provided, this wins over `resolveUser`.
   */
  resolveUserFrom?: NextResolveUser;
  /** Log level for the adapter and runtime — off by default. */
  logLevel?: LogLevel;
  /** Custom logger — when provided, logLevel is ignored. */
  logger?: Logger;
}

/**
 * The whole backend integration, in one call.
 *
 * ```ts
 * // app/api/persona/[...persona]/route.ts
 * import { createPersonaHandler } from '@personaai/nextjs/server';
 * import { auth } from '@clerk/nextjs/server';
 *
 * export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
 *   baseUrl: process.env.PERSONA_BASE_URL!,
 *   credential: process.env.PERSONA_CREDENTIAL!,
 *   resolveUserFrom: async () => (await auth()).userId,
 * });
 *
 * export const dynamic = 'force-dynamic';
 * ```
 */
export function createPersonaHandler(options: CreatePersonaHandlerOptions): PersonaRouteHandlers {
  if (!options.resolveUser && !options.resolveUserFrom) {
    throw new Error('createPersonaHandler: either "resolveUser" or "resolveUserFrom" is required');
  }

  const logger: Logger =
    options.logger ?? createLogger('adapter:nextjs', options.logLevel !== undefined ? { level: options.logLevel } : undefined);
  logger.debug('createPersonaHandler', { hasResolveUser: !!options.resolveUser, hasResolveUserFrom: !!options.resolveUserFrom });
  logger.trace('createPersonaHandler options', { mountPath: options.mountPath, hasHooks: !!options.hooks });

  const runtime = createRuntime({
    ...(options as Omit<CreateRuntimeOptions, 'resolveUser'>),
    logger: logger.child('runtime'),
    // When resolving at the adapter level, the runtime-level resolver becomes
    // a pass-through of the identity the adapter already resolved.
    resolveUser: options.resolveUserFrom
      ? (request) => request.userId ?? null
      : options.resolveUser!,
  } as CreateRuntimeOptions);

  logger.info('runtime created via createPersonaHandler', { hasResolveUserFrom: !!options.resolveUserFrom });
  return toNextRouteHandlers(runtime, { resolveUserFrom: options.resolveUserFrom, logger });
}
