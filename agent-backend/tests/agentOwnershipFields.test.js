import Agent from '../src/modules/agents/agent.model.js';

/**
 * Developer Platform PR-24 (AD-04, blueprint Phase 9): generalizes Agent
 * ownership so a Project or ExternalUser can own an Agent, not only a
 * Persona User — `ownerId` (required ObjectId ref: User) cannot represent
 * either. `ownerId` is now conditionally required (only for
 * `ownerType: 'PersonaUser'`); a new `externalOwnerId` (String) is
 * conditionally required for `ownerType: 'ExternalUser'`. No separate
 * identity field is needed for `ownerType: 'Project'` — the Agent's own
 * `domain` already IS the Project's identity. Schema-only assertions — no
 * DB connection needed.
 */
describe('Agent model — ownership generalization (ownerId / externalOwnerId)', () => {
  const minimalPersonaAgent = {
    ownerId: '507f1f77bcf86cd799439011',
    name: 'Test Agent',
    slug: 'test-agent-' + Math.random().toString(36).slice(2),
    systemPrompt: 'You are a helpful assistant.',
    providerId: '507f1f77bcf86cd799439022',
  };

  test('defaults externalOwnerId to null', () => {
    const agent = new Agent(minimalPersonaAgent);
    expect(agent.externalOwnerId).toBeNull();
  });

  test('existing behavior unaffected: ownerId is still required for a (default) PersonaUser-owned Agent', async () => {
    const agent = new Agent({ ...minimalPersonaAgent, ownerId: undefined });
    await expect(agent.validate()).rejects.toThrow();
  });

  test('a Project-owned Agent validates with neither ownerId nor externalOwnerId', async () => {
    const agent = new Agent({
      name: 'Support Agent',
      slug: 'support-agent-' + Math.random().toString(36).slice(2),
      systemPrompt: 'You are a helpful assistant.',
      providerId: '507f1f77bcf86cd799439022',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'Project',
    });
    await expect(agent.validate()).resolves.toBeUndefined();
    expect(agent.ownerId).toBeUndefined();
    expect(agent.externalOwnerId).toBeNull();
  });

  test('an ExternalUser-owned Agent validates with externalOwnerId and no ownerId', async () => {
    const agent = new Agent({
      name: 'Sabik Support Bot',
      slug: 'sabik-support-bot-' + Math.random().toString(36).slice(2),
      systemPrompt: 'You are a helpful assistant.',
      providerId: '507f1f77bcf86cd799439022',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
      externalOwnerId: 'sabik',
    });
    await expect(agent.validate()).resolves.toBeUndefined();
    expect(agent.ownerId).toBeUndefined();
  });

  test('an ExternalUser-owned Agent without externalOwnerId fails validation', async () => {
    const agent = new Agent({
      name: 'Sabik Support Bot',
      slug: 'sabik-support-bot-' + Math.random().toString(36).slice(2),
      systemPrompt: 'You are a helpful assistant.',
      providerId: '507f1f77bcf86cd799439022',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
    });
    await expect(agent.validate()).rejects.toThrow();
  });
});
