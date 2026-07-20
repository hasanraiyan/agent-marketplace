import { jest } from '@jest/globals';
import { ARCHITECT_AGENT_ID } from '../src/modules/agents/tools/index.js';
import agentFactory, { agentSkillsStore } from '../src/modules/agents/agent.factory.js';
import providerRepository from '../src/modules/providers/provider.repository.js';
import encryption from '../src/utils/encryption.js';

// Mock dependencies
jest.mock('../src/modules/providers/provider.repository.js');
jest.mock('../src/modules/agents/agent.repository.js');
jest.mock('../src/modules/skills/skill.repository.js');
jest.mock('../src/utils/encryption.js');

describe('Architect Improvements', () => {
  const userId = 'user-123';
  const providerId = 'provider-123';
  const defaultProvider = {
    _id: providerId,
    label: 'OpenAI',
    apiKeyEncrypted: 'encrypted-key',
    defaultModel: 'gpt-4o-custom',
    updatedAt: new Date(),
    isDefault: true,
    ownerId: userId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Correctly mock the repository methods
    providerRepository.findByUser = jest.fn().mockResolvedValue([defaultProvider]);
    providerRepository.findById = jest.fn().mockResolvedValue(defaultProvider);
    encryption.decrypt = jest.fn().mockReturnValue('decrypted-key');
  });

  test('T1: Architect cache key is namespaced by userId', async () => {
    const build1 = await agentFactory.buildAgent(ARCHITECT_AGENT_ID, 'user-1', null);
    const build2 = await agentFactory.buildAgent(ARCHITECT_AGENT_ID, 'user-2', null);

    expect(build1).not.toBe(build2);
  });

  test('T5: Architect uses provider.defaultModel as fallback', async () => {
    const { providerConfig } = await agentFactory.buildAgent(ARCHITECT_AGENT_ID, userId, null);
    expect(providerConfig.modelName).toBe('gpt-4o-custom');
  });

  test('T6: Architect has interruptOn for builder actions', async () => {
    const { agentConfig } = await agentFactory.buildAgent(ARCHITECT_AGENT_ID, userId, null);
    expect(agentConfig.interruptOn).toEqual({
      upsert_agent: true,
      manage_skill: true,
      delete_agent: true,
    });
  });

  test('T11: Architect has hardcoded agent-architecture skill', async () => {
    // Skills are served live from the read-only skills store (no per-invoke
    // seeding). The Architect's skill is a static entry in that store.
    const item = await agentSkillsStore.get(
      ['agents', ARCHITECT_AGENT_ID, 'enabled'],
      '/agent-architecture/SKILL.md'
    );
    expect(item).not.toBeNull();
    expect(item.value.content).toContain('agent-architecture');
  });
});
