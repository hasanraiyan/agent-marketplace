import Agent from '../src/modules/agents/agent.model.js';

/**
 * Developer Platform PR-8 (AD-03, AD-04, blueprint Phase 3, first slice):
 * additive-only `domain`/`ownerType` fields on the Agent model. These
 * assertions only construct/validate documents in memory — no DB
 * connection is needed for Mongoose schema defaults/validation.
 */
describe('Agent model — domain/ownerType fields', () => {
  const minimalValidAgent = {
    ownerId: '507f1f77bcf86cd799439011',
    name: 'Test Agent',
    slug: 'test-agent-' + Math.random().toString(36).slice(2),
    systemPrompt: 'You are a helpful assistant.',
    providerId: '507f1f77bcf86cd799439022',
  };

  test('defaults domain to "persona" when not specified, with zero controller changes required', () => {
    const agent = new Agent(minimalValidAgent);
    expect(agent.domain).toBe('persona');
  });

  test('defaults ownerType to "PersonaUser" when not specified', () => {
    const agent = new Agent(minimalValidAgent);
    expect(agent.ownerType).toBe('PersonaUser');
  });

  test('accepts an explicit domain, for future Project-owned Agents', () => {
    const agent = new Agent({ ...minimalValidAgent, domain: '507f1f77bcf86cd799439099' });
    expect(agent.domain).toBe('507f1f77bcf86cd799439099');
  });

  test('accepts an explicit ownerType of "Project", for future Project-owned Agents', () => {
    const agent = new Agent({ ...minimalValidAgent, ownerType: 'Project' });
    expect(agent.ownerType).toBe('Project');
  });

  test('rejects an ownerType outside the supported enum', async () => {
    const agent = new Agent({ ...minimalValidAgent, ownerType: 'NotARealOwnerType' });
    await expect(agent.validate()).rejects.toThrow();
  });

  test('existing required-field validation is unaffected by the new fields', async () => {
    const agent = new Agent({ ...minimalValidAgent, name: undefined });
    await expect(agent.validate()).rejects.toThrow();
  });

  test('a fully valid document (including the new default fields) passes validation', async () => {
    const agent = new Agent(minimalValidAgent);
    await expect(agent.validate()).resolves.toBeUndefined();
  });
});
