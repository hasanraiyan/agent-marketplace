import { jest } from '@jest/globals';
import agentFactory from '../src/modules/agents/agent.factory.js';
import agentRepository from '../src/modules/agents/agent.repository.js';
import providerRepository from '../src/modules/providers/provider.repository.js';
import encryption from '../src/utils/encryption.js';

jest.mock('../src/modules/agents/agent.repository.js');
jest.mock('../src/modules/providers/provider.repository.js');
jest.mock('../src/utils/encryption.js');

/**
 * Frontend tools in buildAgent: gated on the Agent's frontendToolsEnabled,
 * never shadowing server tools, and part of the compiled-instance cache key.
 * Same strategy as agentFactoryExecutionContext.test.js — only repository/
 * crypto boundaries are mocked; the real DeepAgent graph compiles.
 */
describe('AgentFactory.buildAgent — frontend tools', () => {
  const ownerId = 'user-owner-1';
  const provider = {
    _id: 'provider-1',
    label: 'OpenAI',
    apiKeyEncrypted: 'encrypted-key',
    defaultModel: 'gpt-4o-mini',
    baseURL: 'https://api.openai.com/v1',
  };

  function makeAgent(overrides = {}) {
    const agent = {
      _id: 'agent-ft',
      name: 'FT Agent',
      ownerId,
      visibility: 'public',
      isActive: true,
      deletedAt: null,
      providerId: 'provider-1',
      systemPrompt: 'You are a helpful assistant.',
      skills: [],
      mcps: [],
      knowledgeBases: [],
      updatedAt: new Date(),
      populate: jest.fn().mockImplementation(async function () {
        return this;
      }),
      ...overrides,
    };
    agent.populate = agent.populate.bind(agent);
    return agent;
  }

  const openPage = {
    name: 'open_page',
    description: 'Open a page in the app.',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
  };

  const build = (frontendTools) =>
    agentFactory.buildAgent('agent-ft', ownerId, null, undefined, { frontendTools });

  beforeEach(() => {
    jest.clearAllMocks();
    providerRepository.findById = jest.fn().mockResolvedValue(provider);
    encryption.decrypt = jest.fn().mockReturnValue('decrypted-key');
    agentFactory.invalidate('agent-ft');
  });

  test('setting off (default): client tools are ignored and do not change the cache key', async () => {
    agentRepository.findById = jest.fn().mockResolvedValue(makeAgent());

    const first = await build([openPage]);
    expect(first.frontendToolNames).toEqual([]);
    expect(first.cacheHit).toBe(false);

    const second = await build(undefined);
    expect(second.cacheHit).toBe(true);
  });

  test('setting on: valid tools become stubs; server/built-in names and invalid entries are dropped', async () => {
    agentRepository.findById = jest
      .fn()
      .mockResolvedValue(makeAgent({ frontendToolsEnabled: true }));

    const result = await build([
      openPage,
      { name: 'present_file', description: 'clash with a built-in Persona tool' },
      { name: 'write_todos', description: 'clash with a deepagents tool' },
      { name: 'bad name!' },
    ]);
    expect(result.frontendToolNames).toEqual(['open_page']);
  });

  test('setting on: cache is keyed by the tool set', async () => {
    agentRepository.findById = jest
      .fn()
      .mockResolvedValue(makeAgent({ frontendToolsEnabled: true }));

    expect((await build([openPage])).cacheHit).toBe(false);
    expect((await build([openPage])).cacheHit).toBe(true); // same set → reuse
    expect((await build([{ ...openPage, name: 'other' }])).cacheHit).toBe(false);
    const none = await build(undefined);
    expect(none.cacheHit).toBe(false); // no tools → its own (tool-less) variant
    expect(none.frontendToolNames).toEqual([]);
  });

  test('invalidate() clears tool-set variants too', async () => {
    agentRepository.findById = jest
      .fn()
      .mockResolvedValue(makeAgent({ frontendToolsEnabled: true }));
    await build([openPage]);
    agentFactory.invalidate('agent-ft');
    expect((await build([openPage])).cacheHit).toBe(false);
  });
});
