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

const mockGetState = jest.fn();
const mockUpdateState = jest.fn();
jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: {
    buildAgent: jest.fn(async () => ({
      agentInstance: { getState: mockGetState, updateState: mockUpdateState },
      llm: null,
    })),
  },
}));

const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
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

  describe('listWorkspaceFiles / getWorkspaceFile', () => {
    test('lists files from the raw checkpoint, filtering /skills/ and directory markers', async () => {
      checkpointService.checkpointer = { getTuple: mockGetTuple };
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetTuple.mockResolvedValue({
        checkpoint: {
          channel_values: {
            files: {
              '/notes.md': { content: 'hello', created_at: '2024-01-01', modified_at: '2024-01-02' },
              '/skills/ignored.md': { content: 'skill seed' },
            },
          },
        },
      });

      const files = await checkpointService.listWorkspaceFiles('thread_1', 'user_1');
      expect(files).toEqual({
        '/notes.md': { content: 'hello', size: 5, created_at: '2024-01-01', modified_at: '2024-01-02' },
      });
    });

    test('getWorkspaceFile throws NotFoundError for a missing path', async () => {
      checkpointService.checkpointer = { getTuple: mockGetTuple };
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetTuple.mockResolvedValue({ checkpoint: { channel_values: { files: {} } } });

      await expect(
        checkpointService.getWorkspaceFile('thread_1', '/missing.md', 'user_1'),
      ).rejects.toThrow('Workspace file not found');
    });

    test('throws for an unauthorized caller, same as getMessages', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      await expect(checkpointService.listWorkspaceFiles('thread_1', 'user_2')).rejects.toThrow(
        'Thread not found',
      );
    });
  });

  describe('writeWorkspaceFile', () => {
    test('reads the live state, merges in the new file, and calls updateState with the FULL files object (not a partial delta)', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetState.mockResolvedValue({
        values: { files: { '/existing.md': { content: 'old', created_at: 't0', modified_at: 't0' } } },
      });

      const result = await checkpointService.writeWorkspaceFile(
        'thread_1',
        '/notes.md',
        'new content',
        'user_1',
      );

      expect(agentFactory.buildAgent).toHaveBeenCalledWith(
        'agent_1',
        'user_1',
        checkpointService.checkpointer,
        expect.any(Object),
      );
      expect(mockUpdateState).toHaveBeenCalledWith(
        { configurable: { thread_id: 'uuid123' } },
        {
          files: expect.objectContaining({
            '/existing.md': expect.objectContaining({ content: 'old' }),
            '/notes.md': expect.objectContaining({ content: 'new content' }),
          }),
        },
      );
      expect(result.content).toBe('new content');
    });

    test('preserves the original created_at when overwriting an existing file', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetState.mockResolvedValue({
        values: { files: { '/notes.md': { content: 'old', created_at: 't0', modified_at: 't0' } } },
      });

      await checkpointService.writeWorkspaceFile('thread_1', '/notes.md', 'updated', 'user_1');

      const [, patch] = mockUpdateState.mock.calls[0];
      expect(patch.files['/notes.md'].created_at).toBe('t0');
      expect(patch.files['/notes.md'].modified_at).not.toBe('t0');
    });

    test('rejects writing to a system-seeded skill file', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      await expect(
        checkpointService.writeWorkspaceFile('thread_1', '/skills/seed.md', 'x', 'user_1'),
      ).rejects.toThrow('Cannot write to a system-seeded skill file');
      expect(mockUpdateState).not.toHaveBeenCalled();
    });

    test('rejects an unauthorized caller before touching the checkpoint', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      await expect(
        checkpointService.writeWorkspaceFile('thread_1', '/notes.md', 'x', 'user_2'),
      ).rejects.toThrow('Thread not found');
      expect(mockUpdateState).not.toHaveBeenCalled();
    });
  });

  describe('deleteWorkspaceFile', () => {
    test('removes the file and calls updateState with the remaining files', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetState.mockResolvedValue({
        values: {
          files: {
            '/keep.md': { content: 'keep' },
            '/remove.md': { content: 'gone' },
          },
        },
      });

      await checkpointService.deleteWorkspaceFile('thread_1', '/remove.md', 'user_1');

      expect(mockUpdateState).toHaveBeenCalledWith(
        { configurable: { thread_id: 'uuid123' } },
        { files: { '/keep.md': { content: 'keep' } } },
      );
    });

    test('throws NotFoundError for a path that does not exist', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      mockGetState.mockResolvedValue({ values: { files: {} } });

      await expect(
        checkpointService.deleteWorkspaceFile('thread_1', '/missing.md', 'user_1'),
      ).rejects.toThrow('Workspace file not found');
      expect(mockUpdateState).not.toHaveBeenCalled();
    });
  });
});
