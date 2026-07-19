import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/repositories/threadRepository.js', () => ({
  default: {
    findById: jest.fn(),
    touchLastMessageAt: jest.fn(),
    update: jest.fn(),
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
const checkpointService = (await import('../src/services/checkpoint.service.js')).default;

describe('Checkpoint Service', () => {
  let mockThread;

  beforeEach(() => {
    jest.clearAllMocks();

    mockThread = {
      _id: 'thread_1',
      threadId: 'uuid123',
      userId: 'user_1',
      agentId: 'agent_1',
      title: 'Existing Conversation',
    };
  });

  describe('getMessages Native LangGraph Lookup', () => {
    test('should correctly retrieve snapshot messages', async () => {
      checkpointService.checkpointer = { getTuple: mockGetTuple };
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetTuple.mockResolvedValue({
        checkpoint: { channel_values: { messages: [{ role: 'assistant', content: 'hello' }] } },
      });

      const result = await checkpointService.getMessages('thread_1', 'user_1');
      expect(result).toEqual({
        messages: [{ role: 'assistant', content: 'hello' }],
        state: {},
        subagentTraces: {},
      });
      expect(mockGetTuple).toHaveBeenCalledWith({ configurable: { thread_id: 'uuid123' } });
    });

    test('should throw error if thread not found', async () => {
      threadRepository.findById.mockResolvedValue(null);
      await expect(checkpointService.getMessages('thread_1', 'user_1')).rejects.toThrow('Thread not found');
    });

    test('should throw error if unauthorized', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      await expect(checkpointService.getMessages('thread_1', 'user_2')).rejects.toThrow('Unauthorized');
    });
  });
});
