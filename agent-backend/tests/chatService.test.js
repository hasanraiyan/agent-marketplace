import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/repositories/threadRepository.js', () => ({
  default: {
    findById: jest.fn(),
    touchLastMessageAt: jest.fn(),
    update: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/repositories/agentRepository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/repositories/providerRepository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: {
    decrypt: jest.fn().mockReturnValue('mocked-decrypted-key'),
  },
}));

// Mock Native LangGraph Checkpointer
const mockGetTuple = jest.fn();
jest.unstable_mockModule('@langchain/langgraph-checkpoint-mongodb', () => ({
  MongoDBSaver: class {
    constructor() { this.getTuple = mockGetTuple; }
  }
}));

jest.unstable_mockModule('mongodb', () => ({
  MongoClient: class {
    constructor() {
      this.connect = jest.fn().mockResolvedValue(true);
    }
  }
}));

// Mock DeepAgents Factory
const mockStreamEvents = jest.fn();
jest.unstable_mockModule('deepagents', () => ({
  createDeepAgent: jest.fn().mockResolvedValue({
    streamEvents: mockStreamEvents
  })
}));

const threadRepository = (await import('../src/repositories/threadRepository.js')).default;
const agentRepository = (await import('../src/repositories/agentRepository.js')).default;
const chatService = (await import('../src/services/chat.service.js')).default;

describe('Chat Service (DeepAgents Runtime Engine)', () => {
  let mockRes;
  let mockThread;
  let mockAgent;

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
      title: 'Existing Conversation'
    };

    mockAgent = {
      _id: 'agent_1',
      providerId: 'prov_1',
      systemPrompt: 'You are an agent',
    };
  });

  describe('streamChat DeepAgent execution', () => {
    test('should reject unauthorized user', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);

      await chatService.streamChat(mockRes, 'thread_1', 'different_user', 'hello');

      expect(mockRes.write).toHaveBeenCalledWith('data: {"error": "Unauthorized"}\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('should invoke deepagent streamEvents and pipe chunk', async () => {
       threadRepository.findById.mockResolvedValue(mockThread);
       agentRepository.findById.mockResolvedValue(mockAgent);
       
       // Simulate deepagent stream event
       async function* mockGenerator() {
         yield { event: 'on_chat_model_stream', data: { chunk: { content: 'chunk1' } } };
       }
       mockStreamEvents.mockReturnValue(mockGenerator());

       // We inject the API key directly just to bypass provider fetch logic internally
       jest.spyOn(chatService, '_getAgentModel').mockResolvedValue({});

       await chatService.streamChat(mockRes, 'thread_1', 'user_1', 'hello');

       expect(mockStreamEvents).toHaveBeenCalledWith(
          { messages: [expect.any(Object)] }, 
          { configurable: { thread_id: 'uuid123' }, version: 'v2' }
       );

       expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":"chunk1"}\n\n');
       expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });
  });

  describe('getMessages Native LangGraph Lookup', () => {
    test('should correctly retrieve snapshot messages', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetTuple.mockResolvedValue({
         checkpoint: { channel_values: { messages: [{ role: 'assistant', content: 'hello' }] } }
      });

      const msgs = await chatService.getMessages('thread_1', 'user_1');
      expect(msgs).toEqual([{ role: 'assistant', content: 'hello' }]);
      expect(mockGetTuple).toHaveBeenCalledWith({ configurable: { thread_id: 'uuid123' } });
    });
  });
});
