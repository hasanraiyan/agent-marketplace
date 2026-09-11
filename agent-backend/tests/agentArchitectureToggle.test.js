import { jest } from '@jest/globals';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MemorySaver } from '@langchain/langgraph';
import { createAgent } from 'langchain';

// Mock repositories and crypto before importing agentFactory
jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: { findById: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/providers/provider.repository.js', () => ({
  default: {
    findById: jest.fn().mockResolvedValue({
      _id: 'provider-1',
      label: 'OpenAI',
      apiKeyEncrypted: 'encrypted',
      defaultModel: 'gpt-4o-mini',
    }),
  },
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: { decrypt: jest.fn().mockReturnValue('decrypted-key') },
}));

jest.unstable_mockModule('../src/modules/tools/index.js', () => ({
  resolveAgentTools: jest.fn().mockResolvedValue({ tools: [], mcpAppMap: {} }),
}));

// Mock CodeSandbox backend service
jest.unstable_mockModule('../src/modules/sandbox/sandbox.service.js', () => ({
  getSandboxBackend: jest.fn().mockResolvedValue({ type: 'mock-sandbox-backend' }),
}));

// Scripted Chat Model that satisfies createAgent / createDeepAgent requirements
class DummyChatModel extends BaseChatModel {
  constructor() {
    super({});
  }
  _llmType() {
    return 'dummy-chat-model';
  }
  bindTools() {
    return this;
  }
  async _generate() {
    return {
      generations: [{ text: 'Hello from model', message: new AIMessage('Hello from model') }],
    };
  }
}

jest.unstable_mockModule('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor() {
      return new DummyChatModel();
    }
  },
}));

const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const sandboxService = await import('../src/modules/sandbox/sandbox.service.js');

describe('Agent Architecture Toggle (DeepAgent vs ReAct Agent)', () => {
  const ownerId = 'user-1';

  function makeAgent(overrides = {}) {
    return {
      _id: 'agent-toggle-1',
      name: 'Toggle Agent',
      ownerId,
      visibility: 'public',
      isActive: true,
      providerId: 'provider-1',
      systemPrompt: 'You are a test assistant.',
      skills: [],
      mcps: [],
      knowledgeBases: [],
      storeMounts: [],
      updatedAt: new Date(),
      populate: jest.fn().mockImplementation(async function () {
        return this;
      }),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    agentFactory.invalidate('agent-toggle-1');
  });

  describe('AgentFactory.buildAgent branching', () => {
    test('builds ReAct agent when agentType is "react"', async () => {
      const agentDoc = makeAgent({ agentType: 'react' });
      agentRepository.findById.mockResolvedValue(agentDoc);

      const result = await agentFactory.buildAgent('agent-toggle-1', ownerId, null);

      expect(result.agentInstance).toBeDefined();
      expect(result.sandboxBackend).toBeNull();
      expect(result.agentConfig.agentType).toBe('react');
    });

    test('builds DeepAgent when agentType is "deepagent"', async () => {
      const agentDoc = makeAgent({ agentType: 'deepagent' });
      agentRepository.findById.mockResolvedValue(agentDoc);

      const result = await agentFactory.buildAgent('agent-toggle-1', ownerId, null);

      expect(result.agentInstance).toBeDefined();
      expect(result.agentConfig.agentType).toBe('deepagent');
    });

    test('defaults to DeepAgent when agentType is undefined on legacy agent', async () => {
      const agentDoc = makeAgent();
      delete agentDoc.agentType;
      agentRepository.findById.mockResolvedValue(agentDoc);

      const result = await agentFactory.buildAgent('agent-toggle-1', ownerId, null);

      expect(result.agentInstance).toBeDefined();
      expect(result.sandboxBackend).toBeNull();
    });

    test('react-mode agents ignore sandboxEnabled and do not instantiate sandboxBackend', async () => {
      const agentDoc = makeAgent({ agentType: 'react', sandboxEnabled: true });
      agentRepository.findById.mockResolvedValue(agentDoc);

      const result = await agentFactory.buildAgent('agent-toggle-1', ownerId, null);

      expect(result.agentInstance).toBeDefined();
      expect(result.sandboxBackend).toBeNull();
      expect(sandboxService.getSandboxBackend).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Mode Thread Continuity & Checkpoint Channel Compatibility', () => {
    test('createAgent (react mode) successfully loads and executes from a checkpoint containing extra deepagent channels (files, todos)', async () => {
      const checkpointer = new MemorySaver();
      const threadId = 'cross-mode-thread-1';
      const config = { configurable: { thread_id: threadId } };

      // 1. Simulate existing thread state previously recorded by deepagents
      // Deepagents stores channel values including messages, files, and todos
      const priorMessages = [
        new HumanMessage('What files do I have?'),
        new AIMessage('You have index.md in memory.'),
      ];

      // Put a checkpoint that mimics deepagents state schema
      await checkpointer.put(
        config,
        {
          v: 1,
          id: 'checkpoint-1',
          ts: '2026-09-12T00:00:00.000Z',
          channel_values: {
            messages: priorMessages,
            files: { '/memories/user/index.md': '# Memory\n- user prefers python' },
            todos: [{ id: '1', task: 'Summarize sales', status: 'done' }],
          },
          channel_versions: {
            messages: 2,
            files: 1,
            todos: 1,
          },
          versions_seen: {},
        },
        {},
        {}
      );

      // 2. Instantiate a ReAct agent graph via createAgent
      const reactAgent = await createAgent({
        model: new DummyChatModel(),
        systemPrompt: 'You are a lightweight react agent.',
        checkpointer,
        tools: [],
      });

      // 3. Verify state can be read from checkpoint without errors
      const state = await reactAgent.getState(config);
      expect(state).toBeDefined();
      expect(state.values).toBeDefined();
      expect(state.values.messages).toHaveLength(2);

      // 4. Send a new turn on the same thread
      const response = await reactAgent.invoke(
        { messages: [new HumanMessage('Continue the conversation')] },
        config
      );

      expect(response).toBeDefined();
      expect(response.messages.length).toBeGreaterThanOrEqual(3);

      // 5. Verify resumed state has latest messages
      const updatedState = await reactAgent.getState(config);
      expect(updatedState.values.messages.length).toBeGreaterThanOrEqual(3);
    });
  });
});
