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
    test('createAgent (react mode) successfully resumes a conversation previously initiated under deepagents', async () => {
      const { createDeepAgent } = await import('deepagents');
      const checkpointer = new MemorySaver();
      const threadId = 'cross-mode-thread-1';
      const config = { configurable: { thread_id: threadId } };

      // 1. Run first turn under deepagents
      const deepAgent = await createDeepAgent({
        model: new DummyChatModel(),
        systemPrompt: 'You are a deep agent.',
        checkpointer,
        tools: [],
      });

      const firstResponse = await deepAgent.invoke(
        { messages: [new HumanMessage('Hello from deepagent turn')] },
        config
      );
      expect(firstResponse).toBeDefined();
      expect(firstResponse.messages.length).toBeGreaterThanOrEqual(2);

      // Verify deepagent checkpoint includes its extra channels
      const deepState = await deepAgent.getState(config);
      expect(deepState.values.files).toBeDefined();

      // 2. Now user toggles agent to react mode — instantiate via createAgent on the same checkpointer
      const reactAgent = await createAgent({
        model: new DummyChatModel(),
        systemPrompt: 'You are a lightweight react agent.',
        checkpointer,
        tools: [],
      });

      // 3. Verify state can be read by createAgent without crashing on extra channels
      const reactInitialState = await reactAgent.getState(config);
      expect(reactInitialState).toBeDefined();
      expect(reactInitialState.values.messages).toHaveLength(deepState.values.messages.length);

      // 4. Send a second turn on the same thread in react mode
      const secondResponse = await reactAgent.invoke(
        { messages: [new HumanMessage('Hello from react turn')] },
        config
      );
      expect(secondResponse).toBeDefined();
      expect(secondResponse.messages.length).toBeGreaterThan(firstResponse.messages.length);

      // 5. Verify resumed state in checkpointer
      const reactUpdatedState = await reactAgent.getState(config);
      expect(reactUpdatedState.values.messages.length).toBe(secondResponse.messages.length);
    });
  });

  describe('Workflow Snapshot-Pinning integration', () => {
    test('agentSnapshotSchema accepts agentType and defaults to deepagent', async () => {
      const { default: WorkflowVersion } = await import(
        '../src/modules/developer/workflows/workflowVersion.model.js'
      );
      const doc = new WorkflowVersion({
        workflowId: '64a000000000000000000001',
        projectId: '64a000000000000000000002',
        version: 1,
        agentSnapshots: {
          step1: {
            modelName: 'gpt-4o',
            systemPrompt: 'Do things',
            tools: ['t1'],
            agentType: 'react',
          },
          step2: {
            modelName: 'gpt-4o',
            systemPrompt: 'Do other things',
            tools: [],
          },
        },
      });

      expect(doc.agentSnapshots.get('step1').agentType).toBe('react');
      expect(doc.agentSnapshots.get('step2').agentType).toBe('deepagent');
    });
  });
});
