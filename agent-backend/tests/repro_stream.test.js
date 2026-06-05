import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/repositories/threadRepository.js', () => ({
  default: {
    findById: jest.fn(),
    touchLastMessageAt: jest.fn(),
    update: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/factories/agentFactory.js', () => ({
  default: {
    buildAgent: jest.fn(),
  },
}));

jest.unstable_mockModule('@langchain/langgraph-checkpoint-mongodb', () => ({
  MongoDBSaver: class {
    constructor() {}
    getTuple() { return null; }
  },
}));

jest.unstable_mockModule('mongodb', () => ({
  MongoClient: class {
    constructor() {
      this.connect = jest.fn().mockResolvedValue(true);
    }
  },
}));

const threadRepository = (await import('../src/repositories/threadRepository.js')).default;
const agentFactory = (await import('../src/factories/agentFactory.js')).default;
const chatService = (await import('../src/services/chat.service.js')).default;

describe('Reproduction: Stream Disconnect on Tool Call', () => {
  let mockRes;
  let mockThread;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRes = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    mockThread = {
      _id: 'thread_1',
      threadId: 'uuid123',
      userId: 'user_1',
      agentId: 'agent_1',
      title: 'Existing Conversation',
      populated: jest.fn().mockReturnValue('agent_1'),
    };
  });

  test('should continue streaming after tool call', async () => {
    threadRepository.findById.mockResolvedValue(mockThread);

    const mockStreamEvents = jest.fn();
    async function* mockGenerator() {
      yield { event: 'on_chat_model_stream', data: { chunk: { content: 'Thinking...' } } };
      yield { event: 'on_tool_start', name: 'search_web', data: { input: { query: 'test' } } };
      yield { event: 'on_tool_end', name: 'search_web', data: { output: 'search results' } };
      yield { event: 'on_chat_model_stream', data: { chunk: { content: ' Based on search, the answer is 42.' } } };
    }
    mockStreamEvents.mockReturnValue(mockGenerator());

    agentFactory.buildAgent.mockResolvedValue({
      agentInstance: { streamEvents: mockStreamEvents },
      agentConfig: { _id: 'agent_1' },
      llm: { invoke: jest.fn().mockResolvedValue({ content: 'Summary' }) },
    });

    await chatService.streamChat(mockRes, 'thread_1', 'user_1', 'hello');

    // Check that we got all chunks
    const writes = mockRes.write.mock.calls.map(call => call[0]);
    console.log('Writes:', writes);

    expect(writes).toContain(`data: ${JSON.stringify({ chunk: 'Thinking...' })}\n\n`);
    expect(writes).toContain(`data: ${JSON.stringify({ tool: 'Executing search_web...' })}\n\n`);
    expect(writes).toContain(`data: ${JSON.stringify({ tool_output: 'search results', tool: 'search_web' })}\n\n`);
    expect(writes).toContain(`data: ${JSON.stringify({ chunk: ' Based on search, the answer is 42.' })}\n\n`);
    expect(writes).toContain(`data: [DONE]\n\n`);
    expect(mockRes.end).toHaveBeenCalledTimes(1);
  });
});
