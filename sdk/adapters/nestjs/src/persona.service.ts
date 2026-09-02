import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PersonaClient } from '@personaai/sdk';
import { createLogger, type Logger } from '@personaai/sdk';
import type { Runtime } from '@personaai/runtime';
import { PERSONA_CLIENT, PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME } from './constants.js';
import type { PersonaModuleOptions } from './interfaces/persona-options.interface.js';

@Injectable()
export class PersonaService implements OnModuleDestroy {
  private readonly logger: Logger;
  private readonly log: Logger;

  constructor(
    @Inject(PERSONA_MODULE_OPTIONS)
    public readonly options: PersonaModuleOptions,
    @Inject(PERSONA_RUNTIME)
    public readonly runtime: Runtime,
    @Inject(PERSONA_CLIENT)
    public readonly client: PersonaClient
  ) {
    this.logger = options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
    this.log = this.logger.child('service');
    this.log.debug('PersonaService constructed', {
      hasBaseUrl: !!options.baseUrl,
      hasRuntime: !!runtime,
      hasClient: !!client,
    });
    this.log.trace('PersonaService config', {
      hasCredential: !!options.credential,
      hasResolveUser: !!options.resolveUser,
      hasResolveUserFrom: !!options.resolveUserFrom,
      routePrefix: options.routePrefix ?? '/api/persona',
    });
    this.log.info('PersonaService ready', {});
  }

  /**
   * Constructs a PersonaClient scoped to a specific end-user.
   * Use this to create threads, run AG-UI streaming chats, or manage user files.
   */
  forUser(externalUserId: string): PersonaClient {
    this.log.debug('forUser called', { hasExternalUserId: !!externalUserId });
    this.log.trace('forUser details', {
      externalUserIdLength: externalUserId?.length ?? 0,
    });
    this.log.info('creating scoped client', {
      hasExternalUserId: !!externalUserId,
    });
    const scoped = new PersonaClient({
      baseUrl: this.options.baseUrl,
      credential: this.options.credential,
      externalUserId,
      fetch: this.options.fetch,
    });
    this.log.debug('scoped client created', {
      hasExternalUserId: !!externalUserId,
    });
    return scoped;
  }

  async onModuleDestroy(): Promise<void> {
    this.log.debug('onModuleDestroy start', {});
    this.log.info('shutting down runtime', {});
    if (typeof this.runtime.close === 'function') {
      try {
        await this.runtime.close();
        this.log.debug('runtime closed', {});
        this.log.info('runtime shutdown complete', {});
      } catch (err) {
        this.log.error('runtime close failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        this.log.warn('runtime shutdown error', {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    } else {
      this.log.warn('runtime close not available', {});
      this.log.trace('runtime has no close method', {});
    }
    this.log.debug('onModuleDestroy complete', {});
  }
}
