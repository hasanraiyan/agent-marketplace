import { jest } from '@jest/globals';
import agentFactory from '../src/modules/agents/agent.factory.js';
import agentRepository from '../src/modules/agents/agent.repository.js';
import providerRepository from '../src/modules/providers/provider.repository.js';
import encryption from '../src/utils/encryption.js';
import { personaExecutionContext } from '../src/modules/agents/agent.service.js';

jest.mock('../src/modules/agents/agent.repository.js');
jest.mock('../src/modules/providers/provider.repository.js');
jest.mock('../src/utils/encryption.js');

/**
 * Developer Platform PR-21 (AD-04, blueprint Phase 8): buildAgent's new
 * `executionContext` parameter, which replaced its previous hardcoded
 * internal `personaExecutionContext(userId)` construction. Exercises the
 * real (non-Architect) buildAgent path, same mocking strategy as
 * architect_improvement.test.js — only repository/crypto boundaries are
 * mocked, the actual factory logic and DeepAgent graph compilation run
 * for real.
 */
describe('AgentFactory.buildAgent — executionContext generalization', () => {
  const ownerId = 'user-owner-1';
  const providerId = 'provider-1';
  const defaultProvider = {
    _id: providerId,
    label: 'OpenAI',
    apiKeyEncrypted: 'encrypted-key',
    defaultModel: 'gpt-4o-mini',
    baseURL: 'https://api.openai.com/v1',
  };

  function makeAgent(overrides = {}) {
    const agent = {
      _id: 'agent-1',
      name: 'Test Agent',
      ownerId,
      visibility: 'public',
      isActive: true,
      deletedAt: null,
      providerId,
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

  beforeEach(() => {
    jest.clearAllMocks();
    providerRepository.findById = jest.fn().mockResolvedValue(defaultProvider);
    encryption.decrypt = jest.fn().mockReturnValue('decrypted-key');
    agentFactory.invalidate('agent-1');
  });

  test('with no executionContext argument, defaults to personaExecutionContext(userId) — identical to pre-PR-21 behavior', async () => {
    const agent = makeAgent({ domain: 'persona' });
    agentRepository.findById = jest.fn().mockResolvedValue(agent);

    const result = await agentFactory.buildAgent('agent-1', ownerId, null);

    expect(result.agentInstance).toBeDefined();
  });

  test('an explicit matching-domain executionContext succeeds', async () => {
    const agent = makeAgent({ domain: 'persona' });
    agentRepository.findById = jest.fn().mockResolvedValue(agent);

    const result = await agentFactory.buildAgent(
      'agent-1',
      ownerId,
      null,
      personaExecutionContext(ownerId)
    );

    expect(result.agentInstance).toBeDefined();
  });

  test('a mismatched-domain executionContext is rejected — the hardcoding this PR removed', async () => {
    const agent = makeAgent({ domain: 'some-project-id' });
    agentRepository.findById = jest.fn().mockResolvedValue(agent);

    await expect(
      agentFactory.buildAgent('agent-1', ownerId, null, personaExecutionContext(ownerId))
    ).rejects.toThrow('Agent deleted or unavailable');
  });

  test('a Project-domain agent for a matching Project executionContext is no longer hardcoded-rejected', async () => {
    const projectId = 'some-project-id';
    const agent = makeAgent({
      domain: projectId,
      visibility: 'public', // public within its own Domain — no owner-specific check needed here
    });
    agentRepository.findById = jest.fn().mockResolvedValue(agent);

    const projectRuntimeContext = { domain: projectId, principalType: 'ProjectRuntime' };

    const result = await agentFactory.buildAgent('agent-1', 'sabik', null, projectRuntimeContext);

    expect(result.agentInstance).toBeDefined();
  });

  test('omitting executionContext still rejects a Project-domain agent, since the default context is always Persona', async () => {
    const agent = makeAgent({ domain: 'some-project-id', visibility: 'public' });
    agentRepository.findById = jest.fn().mockResolvedValue(agent);

    await expect(agentFactory.buildAgent('agent-1', ownerId, null)).rejects.toThrow(
      'Agent deleted or unavailable'
    );
  });

  describe('identity key domain-qualification (PR-23a)', () => {
    test('two different Projects with the same externalUserId string do not collide in the compiled-instance cache', async () => {
      const agentA = makeAgent({
        domain: 'project-alpha',
        visibility: 'public',
        updatedAt: new Date(),
      });
      const agentB = makeAgent({
        domain: 'project-beta',
        visibility: 'public',
        updatedAt: agentA.updatedAt,
      });
      agentFactory.invalidate('agent-1');

      agentRepository.findById = jest.fn().mockResolvedValue(agentA);
      const buildAlpha = await agentFactory.buildAgent('agent-1', 'sabik', null, {
        domain: 'project-alpha',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      });
      expect(buildAlpha.cacheHit).toBe(false);

      // Same agentId, same raw externalUserId string ("sabik"), different
      // Project — this must NOT be a cache hit against Project Alpha's
      // build, or the two Projects' agent instances (and their memory
      // namespaces) would collide.
      agentRepository.findById = jest.fn().mockResolvedValue(agentB);
      const buildBeta = await agentFactory.buildAgent('agent-1', 'sabik', null, {
        domain: 'project-beta',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      });
      expect(buildBeta.cacheHit).toBe(false);
    });

    test('the same (domain, externalUserId) pair does hit cache on a second call', async () => {
      const agent = makeAgent({ domain: 'project-alpha', visibility: 'public' });
      agentFactory.invalidate('agent-1');
      agentRepository.findById = jest.fn().mockResolvedValue(agent);

      const context = {
        domain: 'project-alpha',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      };

      const first = await agentFactory.buildAgent('agent-1', 'sabik', null, context);
      expect(first.cacheHit).toBe(false);

      const second = await agentFactory.buildAgent('agent-1', 'sabik', null, context);
      expect(second.cacheHit).toBe(true);
    });
  });
});
