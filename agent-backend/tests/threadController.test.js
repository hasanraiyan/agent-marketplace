import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: {
    streamChat: jest.fn(),
    cleanupThreads: jest.fn(),
    getMessages: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/thread.service.js', () => ({
  default: {
    createThread: jest.fn(),
    getThreadById: jest.fn(),
    getThreadsForSubject: jest.fn(),
    updateThreadTitle: jest.fn(),
    deleteThread: jest.fn(),
    deleteAllThreadsForSubject: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/thread.validator.js', () => ({
  createThreadSchema: { parse: jest.fn().mockImplementation((data) => data) },
  updateThreadTitleSchema: { parse: jest.fn().mockImplementation((data) => data) },
  streamMessageSchema: { parse: jest.fn().mockImplementation((data) => data) },
}));

const threadController = (await import('../src/modules/threads/thread.controller.js')).default;
const threadService = (await import('../src/modules/threads/thread.service.js')).default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const checkpointService = (await import('../src/modules/threads/checkpoint.service.js')).default;

describe('Thread Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: { id: 'user_1' },
      body: {},
      params: {},
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('create thread', () => {
    test('should return 404 if agent does not exist', async () => {
      mockReq.body.agentId = 'agent_1';
      agentRepository.findById.mockResolvedValue(null);

      await threadController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(threadService.createThread).not.toHaveBeenCalled();
    });

    test('should create thread correctly via threadService', async () => {
      mockReq.body.agentId = 'agent_1';
      agentRepository.findById.mockResolvedValue({ _id: 'agent_1' });
      threadService.createThread.mockResolvedValue({ _id: 'thread_xyz' });

      await threadController.create(mockReq, mockRes, mockNext);

      expect(threadService.createThread).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({ agentId: 'agent_1', threadId: expect.any(String) })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getOne', () => {
    test('returns the thread via threadService.getThreadById', async () => {
      mockReq.params.id = 'thread_1';
      threadService.getThreadById.mockResolvedValue({ _id: 'thread_1' });

      await threadController.getOne(mockReq, mockRes, mockNext);

      expect(threadService.getThreadById).toHaveBeenCalledWith('thread_1', 'user_1');
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: { _id: 'thread_1' } });
    });

    test('collapses "Thread not found" to a 404', async () => {
      mockReq.params.id = 'thread_1';
      threadService.getThreadById.mockRejectedValue(new Error('Thread not found'));

      await threadController.getOne(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('delete thread', () => {
    test('deletes via threadService.deleteThread and cleans up checkpoints', async () => {
      mockReq.params.id = 'thread_1';
      threadService.deleteThread.mockResolvedValue({ threadId: 'uuid-1' });
      checkpointService.cleanupThreads.mockResolvedValue();

      await threadController.delete(mockReq, mockRes, mockNext);

      expect(threadService.deleteThread).toHaveBeenCalledWith('thread_1', 'user_1');
      expect(checkpointService.cleanupThreads).toHaveBeenCalledWith('uuid-1');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Thread permanently removed',
      });
    });

    test('collapses "Thread not found" to a 404', async () => {
      mockReq.params.id = 'thread_1';
      threadService.deleteThread.mockRejectedValue(new Error('Thread not found'));

      await threadController.delete(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('delete all threads', () => {
    test('should delete all threads for the requesting subject', async () => {
      threadService.deleteAllThreadsForSubject.mockResolvedValue({
        deletedCount: 5,
        threadIds: [],
      });

      await threadController.deleteAll(mockReq, mockRes, mockNext);

      expect(threadService.deleteAllThreadsForSubject).toHaveBeenCalledWith('user_1');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'All threads permanently removed',
      });
    });

    test('should pass error to next if the service fails', async () => {
      const err = new Error('Database connection failed');
      threadService.deleteAllThreadsForSubject.mockRejectedValue(err);

      await threadController.deleteAll(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('updateTitle', () => {
    test('updates via threadService.updateThreadTitle', async () => {
      mockReq.params.id = 'thread_1';
      mockReq.body = { title: 'New Title' };
      threadService.updateThreadTitle.mockResolvedValue({ _id: 'thread_1', title: 'New Title' });

      await threadController.updateTitle(mockReq, mockRes, mockNext);

      expect(threadService.updateThreadTitle).toHaveBeenCalledWith(
        'thread_1',
        'user_1',
        'New Title'
      );
    });

    test('collapses "Thread not found" to a 404', async () => {
      mockReq.params.id = 'thread_1';
      mockReq.body = { title: 'New Title' };
      threadService.updateThreadTitle.mockRejectedValue(new Error('Thread not found'));

      await threadController.updateTitle(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
