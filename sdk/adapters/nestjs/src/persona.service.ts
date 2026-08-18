import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PersonaClient } from '@personaai/sdk';
import type { Runtime } from '@personaai/runtime';
import { PERSONA_CLIENT, PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME } from './constants.js';
import type { PersonaModuleOptions } from './interfaces/persona-options.interface.js';

@Injectable()
export class PersonaService implements OnModuleDestroy {
  constructor(
    @Inject(PERSONA_MODULE_OPTIONS)
    public readonly options: PersonaModuleOptions,
    @Inject(PERSONA_RUNTIME)
    public readonly runtime: Runtime,
    @Inject(PERSONA_CLIENT)
    public readonly client: PersonaClient,
  ) {}

  /**
   * Constructs a PersonaClient scoped to a specific end-user.
   * Use this to create threads, run AG-UI streaming chats, or manage user files.
   */
  forUser(externalUserId: string): PersonaClient {
    return new PersonaClient({
      baseUrl: this.options.baseUrl,
      credential: this.options.credential,
      externalUserId,
      fetch: this.options.fetch,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (typeof this.runtime.close === 'function') {
      await this.runtime.close();
    }
  }
}
