import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { Runtime } from '@personaai/runtime';
import { createLogger, type Logger } from '@personaai/logger';
import { PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME } from './constants.js';
import type { PersonaModuleOptions } from './interfaces/persona-options.interface.js';
import { toRuntimeRequestNode } from '../shared/translate-node.js';
import { handleNodeRequest } from '../shared/handler-node.js';

@Injectable()
export class PersonaMiddleware implements NestMiddleware {
  private readonly logger: Logger;
  private readonly log: Logger;

  constructor(
    @Inject(PERSONA_MODULE_OPTIONS)
    private readonly options: PersonaModuleOptions,
    @Inject(PERSONA_RUNTIME)
    private readonly runtime: Runtime,
  ) {
    this.logger = options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
    this.log = this.logger.child('middleware');
    this.log.debug('PersonaMiddleware constructed', {
      hasRuntime: !!runtime,
      hasResolveUserFrom: !!options.resolveUserFrom,
      routePrefix: options.routePrefix ?? '/api/persona',
    });
    this.log.info('PersonaMiddleware ready', { routePrefix: options.routePrefix ?? '/api/persona' });
  }

  async use(req: any, res: any, next: (error?: any) => void): Promise<void> {
    const startMs = Date.now();
    const method = req.method ?? 'GET';
    const path = req.path || req.url;
    this.log.info('request received', { method, path });
    this.log.debug('request start', { method, path, originalUrl: req.originalUrl || req.url });

    const toRuntimeRequest = (r: any, l?: Logger) =>
      toRuntimeRequestNode(r, l, { getPath: (inner, url) => inner.path || url.pathname });

    await handleNodeRequest(
      req,
      res,
      this.runtime,
      toRuntimeRequest as any,
      { resolveUserFrom: this.options.resolveUserFrom as any, logger: this.logger },
      next,
      startMs,
      this.log,
    );
  }
}
