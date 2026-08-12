import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Runtime } from '@personaai/runtime';
import { TranslationError, toRuntimeRequest } from './translate.js';
import { writeRuntimeResponse } from './write.js';

/**
 * Receives the raw Express `Request` and returns the resolved external user
 * id, or `null` (the runtime responds 401). Express-middleware pattern: the
 * host's own auth middleware runs before this adapter and typically attaches
 * the identity to `req` (e.g. `req.user`), which this resolver reads.
 */
export type ExpressResolveUser = (req: Request) => string | null | Promise<string | null>;

/**
 * Exposes the Persona runtime as an Express Router. Mount with
 * `app.use('/api/persona', toExpressRouter(runtime))`.
 *
 * This is a pure translation layer — all routing, auth, and business logic
 * live in the runtime. When `resolveUserFrom` is provided, the adapter
 * resolves the user from the raw Express request (after the host's auth
 * middleware) and hands the identity to the runtime.
 */
export function toExpressRouter(runtime: Runtime, resolveUserFrom?: ExpressResolveUser): Router {
  const router = Router();

  router.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await toRuntimeRequest(req);

      if (resolveUserFrom) {
        try {
          request.userId = await resolveUserFrom(req);
        } catch {
          // Mirrors the runtime's own resolveUser contract: a throwing
          // resolver means "not authenticated" → the runtime responds 401.
          request.userId = null;
        }
      }

      const response = await runtime.handle(request);
      await writeRuntimeResponse(res, response);
    } catch (err) {
      if (res.headersSent) {
        // Headers are already committed (streaming) — nothing left to send.
        if (!res.writableEnded) res.end();
        return;
      }
      if (err instanceof TranslationError) {
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: err.message } });
        return;
      }
      next(err);
    }
  });

  return router;
}
