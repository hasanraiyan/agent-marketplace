import { jest } from '@jest/globals';
import { AIMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MemorySaver } from '@langchain/langgraph';

/**
 * Proves agent.factory.js's storeMounts wiring end-to-end through the real
 * createDeepAgent()/CompositeBackend/StoreBackend/readonlyBackend/
 * gracefulBackend stack — only the Mongo-backed MemoryFile model is faked
 * (an in-memory Map), so MemoryFilesStore's own get/put/search logic runs
 * for real. Everything above that (namespace resolution, readonly
 * enforcement) is exactly what a live agent run would execute.
 */

const memoryFileDocs = new Map();
function docKey(namespace, key) {
  return JSON.stringify({ namespace, key });
}

jest.unstable_mockModule('../src/modules/memory/memory-file.model.js', () => ({
  default: {
    findOne: jest.fn(async ({ namespace, key }) => memoryFileDocs.get(docKey(namespace, key)) || null),
    findOneAndUpdate: jest.fn(async ({ namespace, key }, update) => {
      const now = new Date();
      const existing = memoryFileDocs.get(docKey(namespace, key));
      const doc = {
        namespace,
        key,
        content: update.$set.content,
        mimeType: update.$set.mimeType,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      memoryFileDocs.set(docKey(namespace, key), doc);
      return doc;
    }),
    deleteOne: jest.fn(async ({ namespace, key }) => {
      const existed = memoryFileDocs.delete(docKey(namespace, key));
      return { deletedCount: existed ? 1 : 0 };
    }),
    find: jest.fn(() => ({
      sort: () => ({ exec: async () => [] }),
    })),
    deleteMany: jest.fn(async () => ({ deletedCount: 0 })),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: { findById: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/agents/agent.service.js', () => ({
  default: { canUserExecuteAgent: jest.fn().mockReturnValue(true) },
  personaExecutionContext: (userId) => ({ principalType: 'PersonaUser', personaUserId: userId }),
}));
jest.unstable_mockModule('../src/modules/providers/provider.repository.js', () => ({
  default: {
    findById: jest.fn().mockResolvedValue({
      _id: 'provider-1',
      label: 'OpenAI',
      apiKeyEncrypted: 'encrypted',
      defaultModel: 'gpt-4o-custom',
    }),
  },
}));
jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: { decrypt: jest.fn().mockReturnValue('real-key') },
}));
jest.unstable_mockModule('../src/modules/tools/index.js', () => ({
  resolveAgentTools: jest.fn().mockResolvedValue({ tools: [], mcpAppMap: {} }),
}));

class ScriptedToolCallChatModel extends BaseChatModel {
  constructor(responses) {
    super({});
    this.responses = responses;
    this.calls = 0;
  }
  _llmType() {
    return 'scripted-tool-call-chat-model';
  }
  bindTools() {
    return this;
  }
  async _generate() {
    const message = this.responses[Math.min(this.calls, this.responses.length - 1)];
    this.calls += 1;
    return { generations: [{ text: '', message }] };
  }
}

jest.unstable_mockModule('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor() {
      return currentScriptedModel;
    }
  },
}));

let currentScriptedModel;

const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;

function toolCallResponses(toolName, args, id) {
  return [
    new AIMessage({ content: '', tool_calls: [{ name: toolName, args, id }] }),
    new AIMessage({ content: 'done' }),
  ];
}

function baseAgentDoc(overrides) {
  return {
    _id: 'agent-1',
    name: 'Test Agent',
    systemPrompt: 'You are a test agent.',
    providerId: 'provider-1',
    modelName: 'gpt-4o-custom',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    skills: [],
    mcps: [],
    knowledgeBases: [],
    interruptOn: {},
    isActive: true,
    ...overrides,
  };
}

describe('Agent.storeMounts wiring in agent.factory.js', () => {
  beforeEach(() => {
    memoryFileDocs.clear();
    jest.clearAllMocks();
    agentFactory.invalidate('agent-1');
  });

  test('a domain-scoped store shares one namespace across every external user', async () => {
    const store = { _id: 'store-1', domain: 'proj-1', name: 'notes', scope: 'domain', accessMode: 'readwrite' };
    agentRepository.findById.mockResolvedValue(baseAgentDoc({ storeMounts: [store] }));

    currentScriptedModel = new ScriptedToolCallChatModel(
      toolCallResponses('write_file', { file_path: '/stores/notes/x.md', content: 'shared' }, 'call_1')
    );
    const buildA = await agentFactory.buildAgent('agent-1', 'ext-user-a', new MemorySaver(), {
      principalType: 'ProjectRuntime',
      domain: 'proj-1',
      externalUserId: 'founder-a',
    });
    await buildA.agentInstance.invoke(
      { messages: [{ role: 'user', content: 'go' }] },
      { configurable: { thread_id: 't-a' } }
    );

    agentFactory.invalidate('agent-1'); // force a fresh compiled instance for founder-b
    currentScriptedModel = new ScriptedToolCallChatModel(
      toolCallResponses('read_file', { file_path: '/stores/notes/x.md' }, 'call_2')
    );
    const buildB = await agentFactory.buildAgent('agent-1', 'ext-user-b', new MemorySaver(), {
      principalType: 'ProjectRuntime',
      domain: 'proj-1',
      externalUserId: 'founder-b',
    });
    const resultB = await buildB.agentInstance.invoke(
      { messages: [{ role: 'user', content: 'go' }] },
      { configurable: { thread_id: 't-b' } }
    );
    const readMsg = resultB.messages.find((m) => m.tool_call_id === 'call_2');

    expect(JSON.stringify(readMsg.content)).toContain('shared');
  });

  test('an externalUser-scoped store never leaks one founder\'s partition to another', async () => {
    const store = {
      _id: 'store-2',
      domain: 'proj-1',
      name: 'private-notes',
      scope: 'externalUser',
      accessMode: 'readwrite',
    };
    agentRepository.findById.mockResolvedValue(baseAgentDoc({ storeMounts: [store] }));

    currentScriptedModel = new ScriptedToolCallChatModel(
      toolCallResponses(
        'write_file',
        { file_path: '/stores/private-notes/x.md', content: 'founder A secret' },
        'call_1'
      )
    );
    const buildA = await agentFactory.buildAgent('agent-1', 'ext-user-a', new MemorySaver(), {
      principalType: 'ProjectRuntime',
      domain: 'proj-1',
      externalUserId: 'founder-a',
    });
    await buildA.agentInstance.invoke(
      { messages: [{ role: 'user', content: 'go' }] },
      { configurable: { thread_id: 't-a' } }
    );

    currentScriptedModel = new ScriptedToolCallChatModel(
      toolCallResponses('read_file', { file_path: '/stores/private-notes/x.md' }, 'call_2')
    );
    const buildB = await agentFactory.buildAgent('agent-1', 'ext-user-b', new MemorySaver(), {
      principalType: 'ProjectRuntime',
      domain: 'proj-1',
      externalUserId: 'founder-b',
    });
    const resultB = await buildB.agentInstance.invoke(
      { messages: [{ role: 'user', content: 'go' }] },
      { configurable: { thread_id: 't-b' } }
    );
    const readMsg = resultB.messages.find((m) => m.tool_call_id === 'call_2');

    expect(readMsg.content).not.toContain('founder A secret');
  });

  test('a readonly store rejects an agent write_file call', async () => {
    const store = {
      _id: 'store-3',
      domain: 'proj-1',
      name: 'reference',
      scope: 'domain',
      accessMode: 'readonly',
    };
    agentRepository.findById.mockResolvedValue(baseAgentDoc({ storeMounts: [store] }));

    currentScriptedModel = new ScriptedToolCallChatModel(
      toolCallResponses(
        'write_file',
        { file_path: '/stores/reference/x.md', content: 'should not be written' },
        'call_1'
      )
    );
    const build = await agentFactory.buildAgent('agent-1', 'ext-user-a', new MemorySaver(), {
      principalType: 'ProjectRuntime',
      domain: 'proj-1',
      externalUserId: 'founder-a',
    });
    const result = await build.agentInstance.invoke(
      { messages: [{ role: 'user', content: 'go' }] },
      { configurable: { thread_id: 't-readonly' } }
    );
    const toolMsg = result.messages.find((m) => m.tool_call_id === 'call_1');

    expect(toolMsg.content).toContain('read-only');
    expect(memoryFileDocs.size).toBe(0);
  });
});
