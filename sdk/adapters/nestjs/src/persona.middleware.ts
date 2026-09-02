import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { Runtime } from '@personaai/runtime';
import { createLogger, type Logger } from '@personaai/sdk';
import { PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME } from './constants.js';
import type { PersonaModuleOptions } from './interfaces/persona-options.interface.js';
import { TranslationError, toRuntimeRequest } from './translate.js';
import { writeRuntimeResponse } from './write.js';

@Injectable()
export class PersonaMiddleware implements NestMiddleware {
  private readonly logger: Logger;
  private readonly log: Logger;

  constructor(
    @Inject(PERSONA_MODULE_OPTIONS)
    private readonly options: PersonaModuleOptions,
    @Inject(PERSONA_RUNTIME)
    private readonly runtime: Runtime
  ) {
    this.logger = options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
    this.log = this.logger.child('middleware');
    this.log.debug('PersonaMiddleware constructed', {
      hasRuntime: !!runtime,
      hasResolveUserFrom: !!options.resolveUserFrom,
      routePrefix: options.routePrefix ?? '/api/persona',
    });
    this.log.trace('PersonaMiddleware config', {
      hasBaseUrl: !!options.baseUrl,
      hasLogger: !!options.logger,
      hasLogLevel: !!options.logLevel,
    });
    this.log.info('PersonaMiddleware ready', {
      routePrefix: options.routePrefix ?? '/api/persona',
    });
  }

  async use(req: any, res: any, next: (error?: any) => void): Promise<void> {
    const startMs = Date.now();
    const method = req.method ?? 'GET';
    const path = req.path || req.url;
    this.log.info('request received', { method, path });
    this.log.debug('request start', {
      method,
      path,
      originalUrl: req.originalUrl || req.url,
    });
    this.log.trace('request details', {
      method,
      path,
      originalUrl: req.originalUrl || req.url,
      headers: (() => {
        const h: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers || {})) {
          if (v === undefined) continue;
          const val = Array.isArray(v) ? v.join(', ') : (v as string);
          h[k] = k.toLowerCase() === 'authorization' ? '***' : val;
        }
        return h;
      })(),
    });

    try {
      const request = await toRuntimeRequest(req, this.logger);

      if (this.options.resolveUserFrom) {
        this.log.debug('resolving user via resolveUserFrom', {
          path: request.path,
        });
        this.log.trace('resolveUserFrom start', { path: request.path });
        try {
          request.userId = await this.options.resolveUserFrom(req);
          this.log.debug('resolveUserFrom result', {
            hasUserId: !!request.userId,
            path: request.path,
          });
          this.log.trace('resolveUserFrom completed', {
            hasUserId: !!request.userId,
          });
          if (request.userId) {
            this.log.info('user resolved', { path: request.path });
          } else {
            this.log.warn('resolveUserFrom returned null — will be 401', {
              path: request.path,
            });
          }
        } catch (err) {
          this.log.warn('resolveUserFrom threw — treating as unauthenticated', {
            path: request.path,
            error: err instanceof Error ? err.message : String(err),
          });
          this.log.trace('resolveUserFrom throw details', { error: err });
          request.userId = null;
        }
      } else {
        this.log.trace('no resolveUserFrom — deferring to runtime resolveUser', {
          path: request.path,
        });
      }

      this.log.debug('calling runtime.handle', {
        method: request.method,
        path: request.path,
      });
      const response = await this.runtime.handle(request);
      const durationMs = Date.now() - startMs;
      this.log.debug('runtime handled', {
        status: response.status,
        kind: response.kind,
        durationMs,
        path: request.path,
      });
      this.log.info('runtime response', {
        status: response.status,
        kind: response.kind,
        durationMs,
      });
      this.log.trace('runtime response details', {
        status: response.status,
        kind: response.kind,
        headers: response.headers,
      });

      await writeRuntimeResponse(res, response, this.logger);
      const totalMs = Date.now() - startMs;
      this.log.info('request completed', {
        method,
        path,
        status: response.status,
        kind: response.kind,
        durationMs: totalMs,
      });
      this.log.debug('request finished', {
        method,
        path,
        status: response.status,
        durationMs: totalMs,
      });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      if (res.headersSent) {
        this.log.warn('headers already sent — cannot send error response', {
          path: req.path,
          durationMs,
        });
        this.log.trace('headersSent true details', {
          writableEnded: res.writableEnded,
        });
        if (!res.writableEnded) res.end();
        return;
      }
      if (err instanceof TranslationError) {
        this.log.warn('translation error', {
          path: req.path,
          error: err.message,
          durationMs,
        });
        this.log.debug('translation error details', { error: err.message });
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: err.message } });
        this.log.info('sent 400 translation error', {
          path: req.path,
          durationMs,
        });
        return;
      }
      this.log.error('unhandled adapter error', {
        path: req.path,
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      });
      this.log.trace('adapter error stack', {
        error: err instanceof Error ? err.stack : String(err),
      });
      next(err);
    }
  }
}
