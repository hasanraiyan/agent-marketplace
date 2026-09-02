import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { PersonaModule } from '../src/persona.module.js';
import { PersonaService } from '../src/persona.service.js';
import { PERSONA_CLIENT, PERSONA_RUNTIME } from '../src/constants.js';

describe('PersonaModule', () => {
  it('should initialize PersonaModule with forRoot and provide PersonaService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PersonaModule.forRoot({
          baseUrl: 'https://api.persona.hasanraiyan.me',
          credential: 'test-key.test-secret',
          resolveUserFrom: (req) => req.user?.id ?? null,
        }),
      ],
    }).compile();

    const service = moduleRef.get(PersonaService);
    const runtime = moduleRef.get(PERSONA_RUNTIME);
    const client = moduleRef.get(PERSONA_CLIENT);

    expect(service).toBeDefined();
    expect(runtime).toBeDefined();
    expect(client).toBeDefined();
    expect(service.client).toBe(client);
    expect(service.runtime).toBe(runtime);

    const userClient = service.forUser('user-123');
    expect(userClient).toBeDefined();
  });
});
