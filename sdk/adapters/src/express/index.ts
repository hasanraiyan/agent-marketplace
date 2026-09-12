import { createRuntime } from '@personaai/runtime';
import type { CreateRuntimeOptions, ResolveUser, Runtime } from '@personaai/runtime';
import { createLogger, type Logger, type LogLevel } from '@personaai/logger';
import type { Router } from 'express';
import { toExpressRouter } from './toExpressRouter.js';
import type { ExpressResolveUser } from './toExpressRouter.js';

export { toExpressRouter };
export type { ExpressResolveUser };
export type { Logger, LogLevel };

/** Version of this unified package. */
export const VERSION = '0.2.0';

export interface CreateExpressAdapterOptions extends Omit<CreateRuntimeOptions, 'resolveUser'> {
  resolveUser?: ResolveUser;
  resolveUserFrom?: ExpressResolveUser;
  logLevel?: LogLevel;
  logger?: Logger;
}

/**
 * Convenience factory: creates the runtime internally and returns it alongside
 * the router, so `runtime.close()` is reachable for shutdown hooks.
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

  if (!options.resolveUser && !options.resolveUserFrom) {
    log.error('createExpressAdapter missing resolver', {});
    throw new Error('createExpressAdapter: either "resolveUser" or "resolveUserFrom" is required');
  }

  if (options.resolveUser && options.resolveUserFrom) {
    log.warn('both resolveUser and resolveUserFrom provided — resolveUserFrom will win', {});
  }

  const runtime = createRuntime({
    ...options,
    resolveUser: options.resolveUserFrom
      ? (request) => request.userId ?? null
      : options.resolveUser!,
  });

  const router = toExpressRouter(runtime, options.resolveUserFrom, { logger });

  log.info('adapter created', { hasResolveUserFrom: !!options.resolveUserFrom });

  return { router, runtime };
}
