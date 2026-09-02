import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Runtime } from '@personaai/runtime';
import { createLogger, type Logger, type LogLevel } from '@personaai/sdk';
import { TranslationError, toRuntimeRequest } from './translate.js';
import { writeRuntimeResponse } from './write.js';

/**
 * Receives the raw Express `Request` and returns the resolved external user
 * id, or `null` (the runtime responds 401). Express-middleware pattern: the
 * host's own auth middleware runs before this adapter and typically attaches
 * the identity to `req` (e.g. `req.user`), which this resolver reads.
 */
export type ExpressResolveUser = (req: Request) => string | null | Promise<string | null>;

export interface ToExpressRouterOptions {
  logger?: Logger;
  logLevel?: LogLevel;
}

/**
 * Exposes the Persona runtime as an Express Router. Mount with
 * `app.use('/api/persona', toExpressRouter(runtime))`.
 *
 * This is a pure translation layer — all routing, auth, and business logic
 * live in the runtime. When `resolveUserFrom` is provided, the adapter
 * resolves the user from the raw Express request (after the host's auth
 * middleware) and hands the identity to the runtime.
 */
export function toExpressRouter(runtime: Runtime, resolveUserFrom?: ExpressResolveUser): Router;
export function toExpressRouter(
  runtime: Runtime,
  resolveUserFrom: ExpressResolveUser | undefined,
  options: ToExpressRouterOptions
): Router;
export function toExpressRouter(
  runtime: Runtime,
  resolveUserFrom?: ExpressResolveUser,
  options?: ToExpressRouterOptions
): Router {
  const logger: Logger =
    options?.logger ?? createLogger('adapter:express', { level: options?.logLevel });
  const routerLog = logger.child('router');
  const translateLog = logger; // toRuntimeRequest will child('translate') itself
  const writeLog = logger; // writeRuntimeResponse will child('write') itself

  routerLog.debug('toExpressRouter creating router', {
    hasResolveUserFrom: !!resolveUserFrom,
  });
  routerLog.trace('toExpressRouter config', {
    hasRuntime: !!runtime,
    hasResolveUserFrom: !!resolveUserFrom,
  });

  const router = Router();

  router.use(async (req: Request, res: Response, next: NextFunction) => {
    const startMs = Date.now();
    const method = req.method ?? 'GET';
    const path = req.path;
    routerLog.info('request received', { method, path });
    routerLog.debug('request start', { method, path, originalUrl: req.originalUrl });
    routerLog.trace('request details', {
      method,
      path,
      originalUrl: req.originalUrl,
      headers: (() => {
        const h: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (v === undefined) continue;
          const val = Array.isArray(v) ? v.join(', ') : v;
          h[k] = k.toLowerCase() === 'authorization' ? '***' : val;
        }
        return h;
      })(),
    });

    try {
      const request = await toRuntimeRequest(req, translateLog);

      if (resolveUserFrom) {
        routerLog.debug('resolving user via resolveUserFrom', { path: request.path });
        routerLog.trace('resolveUserFrom start', { path: request.path });
        try {
          request.userId = await resolveUserFrom(req);
          routerLog.debug('resolveUserFrom result', {
            hasUserId: !!request.userId,
            path: request.path,
          });
          routerLog.trace('resolveUserFrom completed', {
            hasUserId: !!request.userId,
          });
          if (request.userId) {
            routerLog.info('user resolved', { path: request.path });
          } else {
            routerLog.warn('resolveUserFrom returned null — will be 401', { path: request.path });
          }
        } catch (err) {
          routerLog.warn('resolveUserFrom threw — treating as unauthenticated', {
            path: request.path,
            error: err instanceof Error ? err.message : String(err),
          });
          routerLog.trace('resolveUserFrom throw details', { error: err });
          // Mirrors the runtime's own resolveUser contract: a throwing
          // resolver means "not authenticated" → the runtime responds 401.
          request.userId = null;
        }
      } else {
        routerLog.trace('no resolveUserFrom — deferring to runtime resolveUser', {
          path: request.path,
        });
      }

      routerLog.debug('calling runtime.handle', { method: request.method, path: request.path });
      const response = await runtime.handle(request);
      const durationMs = Date.now() - startMs;
      routerLog.debug('runtime handled', {
        status: response.status,
        kind: response.kind,
        durationMs,
        path: request.path,
      });
      routerLog.info('runtime response', {
        status: response.status,
        kind: response.kind,
        durationMs,
      });
      routerLog.trace('runtime response details', {
        status: response.status,
        kind: response.kind,
        headers: response.headers,
      });

      await writeRuntimeResponse(res, response, writeLog);
      const totalMs = Date.now() - startMs;
      routerLog.info('request completed', {
        method,
        path,
        status: response.status,
        kind: response.kind,
        durationMs: totalMs,
      });
      routerLog.debug('request finished', {
        method,
        path,
        status: response.status,
        durationMs: totalMs,
      });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      if (res.headersSent) {
        routerLog.warn('headers already sent — cannot send error response', {
          path: req.path,
          durationMs,
        });
        routerLog.trace('headersSent true details', { writableEnded: res.writableEnded });
        // Headers are already committed (streaming) — nothing left to send.
        if (!res.writableEnded) res.end();
        return;
      }
      if (err instanceof TranslationError) {
        routerLog.warn('translation error', {
          path: req.path,
          error: err.message,
          durationMs,
        });
        routerLog.debug('translation error details', { error: err.message });
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: err.message } });
        routerLog.info('sent 400 translation error', { path: req.path, durationMs });
        return;
      }
      routerLog.error('unhandled adapter error', {
        path: req.path,
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      });
      routerLog.trace('adapter error stack', {
        error: err instanceof Error ? err.stack : String(err),
      });
      next(err);
    }
  });

  routerLog.info('router created', { hasResolveUserFrom: !!resolveUserFrom });
  routerLog.debug('router ready', {});

  return router;
}
