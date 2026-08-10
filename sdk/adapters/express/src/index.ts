import { createRuntime } from '@personaai/runtime';
import type { CreateRuntimeOptions, ResolveUser, Runtime } from '@personaai/runtime';
import type { Router } from 'express';
import { toExpressRouter } from './toExpressRouter.js';
import type { ExpressResolveUser } from './toExpressRouter.js';

export { toExpressRouter };
export type { ExpressResolveUser };

/** Version of this package, kept in sync with `package.json`. */
export const VERSION = '0.1.0';

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
  if (!options.resolveUser && !options.resolveUserFrom) {
    throw new Error('createExpressAdapter: either "resolveUser" or "resolveUserFrom" is required');
  }

  const runtime = createRuntime({
    ...options,
    // When resolving at the adapter level, the runtime-level resolver becomes
    // a pass-through of the identity the adapter already resolved.
    resolveUser: options.resolveUserFrom
      ? (request) => request.userId ?? null
      : options.resolveUser!,
  });
  const router = toExpressRouter(runtime, options.resolveUserFrom);
  return { router, runtime };
}
