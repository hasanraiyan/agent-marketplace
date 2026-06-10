import { jest } from '@jest/globals';
import { ARCHITECT_AGENT_ID } from '../src/tools/index.js';
import agentFactory from '../src/factories/agentFactory.js';
import providerRepository from '../src/repositories/providerRepository.js';
import encryption from '../src/utils/encryption.js';

// Mock dependencies
jest.mock('../src/repositories/providerRepository.js');
jest.mock('../src/repositories/agentRepository.js');
jest.mock('../src/repositories/skillRepository.js');
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
    const { skillFiles } = await agentFactory.buildAgent(ARCHITECT_AGENT_ID, userId, null);
    expect(skillFiles['/skills/agent-architecture/SKILL.md']).toBeDefined();
    expect(skillFiles['/skills/agent-architecture/SKILL.md'].content.join('\n')).toContain('agent-architecture');
  });
});
