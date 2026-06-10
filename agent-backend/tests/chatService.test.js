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

// Mock Native LangGraph Checkpointer
const mockGetTuple = jest.fn();
jest.unstable_mockModule('@langchain/langgraph-checkpoint-mongodb', () => ({
  MongoDBSaver: class {
    constructor() {
      this.getTuple = mockGetTuple;
    }
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

describe('Chat Service (DeepAgents Factory Integration)', () => {
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
    };
  });

  describe('streamChat DeepAgent execution via Factory', () => {
    test('should reject unauthorized user', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);

      await chatService.streamChat(mockRes, 'thread_1', 'different_user', 'hello');

      expect(mockRes.write).toHaveBeenCalledWith('data: {"error": "Unauthorized"}\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('should invoke deepagent streamEvents from factory', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);

      const mockStreamEvents = jest.fn();
      async function* mockGenerator() {
        yield { event: 'on_chat_model_stream', data: { chunk: { content: 'chunkV2' } } };
      }
      mockStreamEvents.mockReturnValue(mockGenerator());

      // Mock the factory returning the compiled instance
      agentFactory.buildAgent.mockResolvedValue({
        agentInstance: { streamEvents: mockStreamEvents },
        agentConfig: {},
        llm: {},
      });

      chatService.checkpointer = { getTuple: jest.fn() };
      await chatService.streamChat(mockRes, 'thread_1', 'user_1', 'hello');

      expect(agentFactory.buildAgent).toHaveBeenCalledWith(
        'agent_1',
        'user_1',
        chatService.checkpointer
      );
      expect(mockStreamEvents).toHaveBeenCalled();

      expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":"chunkV2"}\n\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });
  });

  describe('getMessages Native LangGraph Lookup', () => {
    test('should correctly retrieve snapshot messages', async () => {
      chatService.checkpointer = { getTuple: mockGetTuple };
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetTuple.mockResolvedValue({
        checkpoint: { channel_values: { messages: [{ role: 'assistant', content: 'hello' }] } },
      });

      const msgs = await chatService.getMessages('thread_1', 'user_1');
      expect(msgs).toEqual([{ role: 'assistant', content: 'hello' }]);
      expect(mockGetTuple).toHaveBeenCalledWith({ configurable: { thread_id: 'uuid123' } });
    });
  });
});
