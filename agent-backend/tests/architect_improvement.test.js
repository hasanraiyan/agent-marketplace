import { jest } from '@jest/globals';
import { ARCHITECT_AGENT_ID, DEVELOPER_ARCHITECT_AGENT_ID } from '../src/modules/tools/index.js';
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

  test('Developer Platform PR-18 (AD-06 §16.4): cached providerConfig never carries the decrypted plaintext key', async () => {
    const { providerConfig } = await agentFactory.buildAgent(ARCHITECT_AGENT_ID, userId, null);
    expect(providerConfig.apiKey).toBeUndefined();
    expect('apiKey' in providerConfig).toBe(false);
  });

  test('T6: Architect gates its manage_* tools behind approval, except read actions', async () => {
    const { agentConfig } = await agentFactory.buildAgent(ARCHITECT_AGENT_ID, userId, null);
    const gatedTools = [
      'manage_agent',
      'manage_skill',
      'manage_mcp',
      'manage_rcp_source',
      'manage_rest_api_tool',
    ];
    for (const name of gatedTools) {
      const when = agentConfig.interruptOn[name]?.when;
      expect(typeof when).toBe('function');
      expect(when({ toolCall: { args: { action: 'read' } } })).toBe(false);
      expect(when({ toolCall: { args: { action: 'create' } } })).toBe(true);
      expect(when({ toolCall: { args: { action: 'update' } } })).toBe(true);
      expect(when({ toolCall: { args: { action: 'patch' } } })).toBe(true);
      expect(when({ toolCall: { args: { action: 'delete' } } })).toBe(true);
    }
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

  test('T12: Architect has hardcoded skill-creator skill (verb/concept persona methodology)', async () => {
    const item = await agentSkillsStore.get(
      ['agents', ARCHITECT_AGENT_ID, 'enabled'],
      '/skill-creator/SKILL.md'
    );
    expect(item).not.toBeNull();
    expect(item.value.content).toContain('skill-creator');
    expect(item.value.content).toContain('@teach');
  });

  test('T13: the SDK-reachable Developer Architect has the same static skills as the other two sentinels', async () => {
    const agentArchitecture = await agentSkillsStore.get(
      ['agents', DEVELOPER_ARCHITECT_AGENT_ID, 'enabled'],
      '/agent-architecture/SKILL.md'
    );
    const skillCreator = await agentSkillsStore.get(
      ['agents', DEVELOPER_ARCHITECT_AGENT_ID, 'enabled'],
      '/skill-creator/SKILL.md'
    );
    expect(agentArchitecture).not.toBeNull();
    expect(skillCreator).not.toBeNull();
  });
});
