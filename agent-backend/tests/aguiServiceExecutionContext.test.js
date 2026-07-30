import { jest } from '@jest/globals';

/**
 * Developer Platform PR-23a (blueprint Phase 8): runAgentAsAguiEvents gains
 * an `executionContext` parameter forwarded to `agentFactory.buildAgent`,
 * replacing the hardcoded `personaExecutionContext(userId)` construction
 * PR-21 had left inside agui.service.js itself. Both the existing Persona
 * route (which omits it) and the future Developer route (which passes a
 * ProjectRuntimeContext) go through this same function.
 */
jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: {
    buildAgent: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: {
    checkpointer: {},
    _autoTitleThread: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agui/aguiTranslator.js', () => ({
  translateLangGraphStream: jest.fn(async function* () {}),
  emitTextNotice: jest.fn(async function* (msg) {
    yield { type: 'text', content: msg };
  }),
  formatRuntimeError: jest.fn((err) => err.message),
  buildResumeValue: jest.fn(),
  describeInterrupt: jest.fn(),
}));

const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const { personaExecutionContext } = await import('../src/modules/agents/agent.service.js');
const { runAgentAsAguiEvents } = await import('../src/modules/agui/agui.service.js');

function mockAgentInstance() {
  return {
    getState: jest.fn().mockResolvedValue({ tasks: [] }),
    streamEvents: jest.fn().mockReturnValue((async function* () {})()),
  };
}

describe('runAgentAsAguiEvents — executionContext forwarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    agentFactory.buildAgent.mockResolvedValue({
      agentInstance: mockAgentInstance(),
      agentConfig: {},
      providerConfig: {},
      llm: {},
      mcpAppMap: {},
    });
  });

  test('defaults to personaExecutionContext(userId) when executionContext is omitted', async () => {
    const events = [];
    for await (const event of runAgentAsAguiEvents({
      agentId: 'agent-1',
      userId: 'user-1',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      events.push(event);
    }

    expect(agentFactory.buildAgent).toHaveBeenCalledWith(
      'agent-1',
      'user-1',
      expect.anything(),
      personaExecutionContext('user-1')
    );
  });

  test('forwards an explicitly passed executionContext (e.g. ProjectRuntimeContext) unchanged', async () => {
    const projectRuntimeContext = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      credentialId: 'cred-1',
      externalUserId: 'sabik',
    };

    for await (const _ of runAgentAsAguiEvents({
      agentId: 'agent-1',
      userId: 'sabik',
      messages: [{ role: 'user', content: 'hi' }],
      executionContext: projectRuntimeContext,
    })) {
      // drain
    }

    expect(agentFactory.buildAgent).toHaveBeenCalledWith(
      'agent-1',
      'sabik',
      expect.anything(),
      projectRuntimeContext
    );
  });
});
