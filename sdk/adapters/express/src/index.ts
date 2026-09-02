import { createRuntime } from '@personaai/runtime';
import type { CreateRuntimeOptions, ResolveUser, Runtime } from '@personaai/runtime';
import { createLogger, type Logger, type LogLevel } from '@personaai/sdk';
import type { Router } from 'express';
import { toExpressRouter } from './toExpressRouter.js';
import type { ExpressResolveUser } from './toExpressRouter.js';

export { toExpressRouter };
export type { ExpressResolveUser };
export type { Logger, LogLevel };

/** Version of this package, kept in sync with `package.json`. */
export const VERSION = '0.1.2';

export interface CreateExpressAdapterOptions extends Omit<CreateRuntimeOptions, 'resolveUser'> {
  /**
   * Runtime-level user resolver — receives the translated request and returns
   * the external user id, or `null` → the runtime responds 401. Provide either
   * this or `resolveUserFrom`.
   */
  resolveUser?: ResolveUser;
  /**
   * Express-middleware-pattern user resolver. Receives the raw Express
   * `Request` (after the host's own auth middleware) and returns the resolved
   * external user id, or `null` → the runtime responds 401. When provided,
   * this wins over `resolveUser`.
   */
  resolveUserFrom?: ExpressResolveUser;
  /** Log level for the adapter and the underlying runtime — off by default. */
  logLevel?: LogLevel;
  /** Custom logger instance — when provided, `logLevel` is ignored. */
  logger?: Logger;
}

/**
 * Convenience factory: creates the runtime internally and returns it alongside
 * the router, so `runtime.close()` is reachable for shutdown hooks.
 *
 * ```ts
 * const persona = createExpressAdapter({
 *   baseUrl: process.env.PERSONA_BASE_URL!,
 *   credential: process.env.PERSONA_CREDENTIAL!,
 *   resolveUserFrom: (req) => req.user?.id ?? null,
 * });
 * app.use('/api/persona', persona.router);
 * ```
 */
export function createExpressAdapter(options: CreateExpressAdapterOptions): {
  router: Router;
  runtime: Runtime;
} {
  const logger: Logger =
    options.logger ?? createLogger('adapter:express', { level: options.logLevel });
  const log = logger.child('factory');

  log.debug('createExpressAdapter init', {
    hasBaseUrl: !!options.baseUrl,
    hasResolveUser: !!options.resolveUser,
    hasResolveUserFrom: !!options.resolveUserFrom,
    mountPath: options.mountPath ?? '',
  });
  log.trace('createExpressAdapter config', {
    mode: options.mode ?? 'default',
    hasHooks: !!options.hooks,
    capabilities: options.capabilities,
    hasLogLevel: !!options.logLevel,
    hasLogger: !!options.logger,
  });

  if (!options.resolveUser && !options.resolveUserFrom) {
    log.error('createExpressAdapter missing resolver', {});
    log.warn('neither resolveUser nor resolveUserFrom provided', {});
    throw new Error('createExpressAdapter: either "resolveUser" or "resolveUserFrom" is required');
  }

  if (options.resolveUser && options.resolveUserFrom) {
    log.warn('both resolveUser and resolveUserFrom provided — resolveUserFrom will win', {});
  }

  log.info('creating runtime', {
    hasResolveUserFrom: !!options.resolveUserFrom,
    mountPath: options.mountPath ?? '',
  });

  const runtime = createRuntime({
    ...options,
    // When resolving at the adapter level, the runtime-level resolver becomes
    // a pass-through of the identity the adapter already resolved.
    resolveUser: options.resolveUserFrom
      ? (request) => request.userId ?? null
      : options.resolveUser!,
  });

  log.debug('runtime created', { hasResolveUserFrom: !!options.resolveUserFrom });
  log.trace('runtime created details', {});

  const router = toExpressRouter(runtime, options.resolveUserFrom, { logger });

  log.info('adapter created', { hasResolveUserFrom: !!options.resolveUserFrom });
  log.debug('adapter ready', {});

  return { router, runtime };
}
