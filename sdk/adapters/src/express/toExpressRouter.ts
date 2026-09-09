import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Runtime } from '@personaai/runtime';
import { createLogger, type Logger, type LogLevel } from '@personaai/logger';
import { toRuntimeRequestNode } from '../shared/translate-node.js';
import { handleNodeRequest } from '../shared/handler-node.js';

export type ExpressResolveUser = (req: Request) => string | null | Promise<string | null>;

export interface ToExpressRouterOptions {
  logger?: Logger;
  logLevel?: LogLevel;
}

export function toExpressRouter(runtime: Runtime, resolveUserFrom?: ExpressResolveUser): Router;
export function toExpressRouter(
  runtime: Runtime,
  resolveUserFrom: ExpressResolveUser | undefined,
  options: ToExpressRouterOptions,
): Router;
export function toExpressRouter(
  runtime: Runtime,
  resolveUserFrom?: ExpressResolveUser,
  options?: ToExpressRouterOptions,
): Router {
  const logger: Logger =
    options?.logger ?? createLogger('adapter:express', { level: options?.logLevel });
  const routerLog = logger.child('router');

  routerLog.debug('toExpressRouter creating router', { hasResolveUserFrom: !!resolveUserFrom });

  const router = Router();

  router.use(async (req: Request, res: Response, next: NextFunction) => {
    const startMs = Date.now();
    const method = req.method ?? 'GET';
    const path = req.path;
    routerLog.info('request received', { method, path });
    routerLog.trace('request details', {
      method,
      path,
      originalUrl: req.originalUrl,
    });

    const toRuntimeRequest = (r: any, l?: Logger) =>
      toRuntimeRequestNode(r, l, { getPath: (inner) => inner.path });

    await handleNodeRequest(
      req,
      res,
      runtime,
      toRuntimeRequest as any,
      { resolveUserFrom: resolveUserFrom as any, logger },
      next,
      startMs,
      routerLog,
    );
  });

  routerLog.info('router created', { hasResolveUserFrom: !!resolveUserFrom });

  return router;
}
