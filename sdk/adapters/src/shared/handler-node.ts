import type { Runtime } from '@personaai/runtime';
import type { Logger } from '@personaai/logger';
import { TranslationError } from './errors.js';
import { writeRuntimeResponse } from './write-node.js';
import type { toRuntimeRequestNode } from './translate-node.js';

export type NodeResolveUser = (req: any) => string | null | Promise<string | null>;

export interface NodeHandlerOptions {
  resolveUserFrom?: NodeResolveUser;
  logger?: Logger;
}

/**
 * Core Node handler shared by Express and NestJS.
 * Translates → optional resolveUserFrom → runtime.handle → write.
 * Handles TranslationError → 400, headersSent, and unexpected → next(err).
 */
export async function handleNodeRequest(
  req: any,
  res: any,
  runtime: Runtime,
  toRuntimeRequest: typeof toRuntimeRequestNode,
  opts: NodeHandlerOptions,
  next: (err?: any) => void,
  startMs: number,
  log: Logger,
): Promise<void> {
  try {
    const request = await toRuntimeRequest(req, opts.logger);

    if (opts.resolveUserFrom) {
      log.debug('resolving user via resolveUserFrom', { path: request.path });
      try {
        request.userId = await opts.resolveUserFrom(req);
        log.debug('resolveUserFrom result', { hasUserId: !!request.userId, path: request.path });
        if (!request.userId) log.warn('resolveUserFrom returned null — will be 401', { path: request.path });
      } catch (err) {
        log.warn('resolveUserFrom threw — treating as unauthenticated', {
          path: request.path,
          error: err instanceof Error ? err.message : String(err),
        });
        request.userId = null;
      }
    }

    log.debug('calling runtime.handle', { method: request.method, path: request.path });
    const response = await runtime.handle(request);
    const durationMs = Date.now() - startMs;
    log.debug('runtime handled', { status: response.status, kind: response.kind, durationMs, path: request.path });
    log.info('runtime response', { status: response.status, kind: response.kind, durationMs });

    await writeRuntimeResponse(res, response, opts.logger);
    const totalMs = Date.now() - startMs;
    log.info('request completed', {
      method: req.method ?? 'GET',
      path: request.path,
      status: response.status,
      kind: response.kind,
      durationMs: totalMs,
    });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    if (res.headersSent) {
      log.warn('headers already sent — cannot send error response', { path: req.path || req.url, durationMs });
      if (!res.writableEnded) res.end();
      return;
    }
    if (err instanceof TranslationError) {
      log.warn('translation error', { path: req.path || req.url, error: err.message, durationMs });
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: err.message } });
      log.info('sent 400 translation error', { path: req.path || req.url, durationMs });
      return;
    }
    log.error('unhandled adapter error', {
      path: req.path || req.url,
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    });
    next(err);
  }
}
