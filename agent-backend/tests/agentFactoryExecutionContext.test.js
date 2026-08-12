import { jest } from '@jest/globals';
import agentFactory from '../src/modules/agents/agent.factory.js';
import agentRepository from '../src/modules/agents/agent.repository.js';
import providerRepository from '../src/modules/providers/provider.repository.js';
import encryption from '../src/utils/encryption.js';
import { personaExecutionContext } from '../src/modules/agents/agent.service.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatDeepSeek } from '@langchain/deepseek';

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

/**
 * Provider type-aware setup: `_buildLLM` branches on `provider.type` to
 * construct the right LangChain chat model. Calls `_buildLLM` directly
 * rather than going through the full `buildAgent`/DeepAgent graph
 * compilation pipeline above — that path is unrelated to this branching
 * and would only add unnecessary weight to what's a pure construction test.
 */
describe('AgentFactory._buildLLM — provider type-aware construction', () => {
  const agent = { providerId: 'provider-1', modelName: undefined };

  beforeEach(() => {
    jest.clearAllMocks();
    encryption.decrypt = jest.fn().mockReturnValue('decrypted-key');
  });

  function makeProvider(overrides = {}) {
    return {
      label: 'Test Provider',
      apiKeyEncrypted: 'encrypted-key',
      defaultModel: 'default-model',
      baseURL: 'https://example.com',
      ...overrides,
    };
  }

  test('defaults to ChatOpenAI when type is missing (pre-existing providers)', async () => {
    const llm = await agentFactory._buildLLM(agent, makeProvider());
    expect(llm).toBeInstanceOf(ChatOpenAI);
  });

  test("type: 'openai' constructs ChatOpenAI", async () => {
    const llm = await agentFactory._buildLLM(agent, makeProvider({ type: 'openai' }));
    expect(llm).toBeInstanceOf(ChatOpenAI);
  });

  test("type: 'custom' constructs ChatOpenAI", async () => {
    const llm = await agentFactory._buildLLM(agent, makeProvider({ type: 'custom' }));
    expect(llm).toBeInstanceOf(ChatOpenAI);
  });

  test("type: 'anthropic' constructs ChatAnthropic", async () => {
    const llm = await agentFactory._buildLLM(agent, makeProvider({ type: 'anthropic' }));
    expect(llm).toBeInstanceOf(ChatAnthropic);
  });

  /**
   * Regression: the Anthropic SDK posts to a relative '/v1/messages' path
   * appended to whatever URL is configured, so a stored baseURL of
   * '.../v1' (needed by the model-listing endpoint, GET {baseURL}/models)
   * must NOT be passed straight through as anthropicApiUrl — that would
   * produce '.../v1/v1/messages' and break every Anthropic agent run.
   */
  test("type: 'anthropic' strips a trailing /v1 from baseURL before constructing the client", async () => {
    const llm = await agentFactory._buildLLM(
      agent,
      makeProvider({ type: 'anthropic', baseURL: 'https://api.anthropic.com/v1' })
    );
    expect(llm.apiUrl).toBe('https://api.anthropic.com');
  });

  test("type: 'anthropic' leaves a baseURL with no /v1 suffix untouched", async () => {
    const llm = await agentFactory._buildLLM(
      agent,
      makeProvider({ type: 'anthropic', baseURL: 'https://my-anthropic-proxy.example.com' })
    );
    expect(llm.apiUrl).toBe('https://my-anthropic-proxy.example.com');
  });

  test("type: 'gemini' constructs ChatGoogleGenerativeAI", async () => {
    const llm = await agentFactory._buildLLM(agent, makeProvider({ type: 'gemini' }));
    expect(llm).toBeInstanceOf(ChatGoogleGenerativeAI);
  });

  test("type: 'deepseek' constructs ChatDeepSeek", async () => {
    const llm = await agentFactory._buildLLM(agent, makeProvider({ type: 'deepseek' }));
    expect(llm).toBeInstanceOf(ChatDeepSeek);
  });
});
