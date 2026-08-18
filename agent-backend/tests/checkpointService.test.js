import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
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

const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const checkpointService = (await import('../src/modules/threads/checkpoint.service.js')).default;

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
        checkpoint: {
          channel_values: {
            messages: [{ id: 'msg_1', getType: () => 'ai', content: 'hello', tool_calls: [] }],
          },
        },
      });

      const result = await checkpointService.getMessages('thread_1', 'user_1');
      expect(result.messages).toEqual([{ id: 'msg_1', role: 'assistant', content: 'hello' }]);
      expect(result.state).toEqual({ files: {}, todos: [] });
      expect(result.subagentTraces).toEqual({});
      expect(mockGetTuple).toHaveBeenCalledWith({ configurable: { thread_id: 'uuid123' } });
    });

    test('merges consecutive AIMessages from one turn into a single assistant message, matching what live streaming already shows as one bubble', async () => {
      checkpointService.checkpointer = { getTuple: mockGetTuple };
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetTuple.mockResolvedValue({
        checkpoint: {
          channel_values: {
            messages: [
              { id: 'human_1', getType: () => 'human', content: 'check my balance' },
              // Decides to call a tool -- no text content of its own, the
              // common LangGraph shape for the "calling a tool" half of a turn.
              {
                id: 'ai_1',
                getType: () => 'ai',
                content: '',
                tool_calls: [{ id: 'call_1', name: 'get_balance', args: {} }],
              },
              {
                getType: () => 'tool',
                tool_call_id: 'call_1',
                content: '{"balance":100}',
                status: 'success',
              },
              // The final text, as a SEPARATE AIMessage after the tool result.
              { id: 'ai_2', getType: () => 'ai', content: 'Your balance is $100.' },
            ],
          },
        },
      });

      const result = await checkpointService.getMessages('thread_1', 'user_1');

      expect(result.messages).toEqual([
        { id: 'human_1', role: 'user', content: 'check my balance' },
        {
          id: 'ai_1',
          role: 'assistant',
          content: 'Your balance is $100.',
          toolCalls: [
            {
              toolCallId: 'call_1',
              toolName: 'get_balance',
              args: '{}',
              result: '{"balance":100}',
              isError: false,
            },
          ],
        },
      ]);
    });

    test('should throw error if thread not found', async () => {
      threadRepository.findById.mockResolvedValue(null);
      await expect(checkpointService.getMessages('thread_1', 'user_1')).rejects.toThrow(
        'Thread not found'
      );
    });

    test('should throw error if unauthorized', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      await expect(checkpointService.getMessages('thread_1', 'user_2')).rejects.toThrow(
        'Unauthorized'
      );
    });
  });
});
