import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { Runtime } from '@personaai/runtime';
import { PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME } from './constants.js';
import type { PersonaModuleOptions } from './interfaces/persona-options.interface.js';
import { TranslationError, toRuntimeRequest } from './translate.js';
import { writeRuntimeResponse } from './write.js';

@Injectable()
export class PersonaMiddleware implements NestMiddleware {
  constructor(
    @Inject(PERSONA_MODULE_OPTIONS)
    private readonly options: PersonaModuleOptions,
    @Inject(PERSONA_RUNTIME)
    private readonly runtime: Runtime,
  ) {}

  async use(req: any, res: any, next: (error?: any) => void): Promise<void> {
    try {
      const request = await toRuntimeRequest(req);

      if (this.options.resolveUserFrom) {
        try {
          request.userId = await this.options.resolveUserFrom(req);
        } catch {
          request.userId = null;
        }
      }

      const response = await this.runtime.handle(request);
      await writeRuntimeResponse(res, response);
    } catch (err) {
      if (res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      if (err instanceof TranslationError) {
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: err.message } });
        return;
      }
      next(err);
    }
  }
}
