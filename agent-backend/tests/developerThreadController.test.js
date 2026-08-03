import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: { findById: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/agents/agent.service.js', () => ({
  default: { canUserExecuteAgent: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: {
    getMessages: jest.fn(),
    cleanupThreads: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/thread.service.js', () => ({
  default: {
    createThread: jest.fn(),
    getThreadById: jest.fn(),
    getThreadsForSubject: jest.fn(),
    updateThreadTitle: jest.fn(),
    updateThread: jest.fn(),
    deleteThread: jest.fn(),
  },
}));

const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentService = (await import('../src/modules/agents/agent.service.js')).default;
const checkpointService = (await import('../src/modules/threads/checkpoint.service.js')).default;
const threadService = (await import('../src/modules/threads/thread.service.js')).default;
const developerThreadController = (
  await import('../src/modules/developer/developerThread.controller.js')
).default;

describe('Developer Thread Controller', () => {
  const runtimeContext = {
    domain: 'project-1',
    principalType: 'ProjectRuntime',
    externalUserId: 'sabik',
  };

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    checkpointService.cleanupThreads.mockResolvedValue();
    mockReq = { projectContext: runtimeContext, body: {}, params: {}, query: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('create', () => {
    test('creates via threadService.createThread when the agent is executable', async () => {
      mockReq.body = { agentId: 'agent_1' };
      agentRepository.findById.mockResolvedValue({ _id: 'agent_1' });
      agentService.canUserExecuteAgent.mockReturnValue(true);
      threadService.createThread.mockResolvedValue({ _id: 't1' });

      await developerThreadController.create(mockReq, mockRes, next);

      expect(threadService.createThread).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ agentId: 'agent_1', threadId: expect.any(String) }),
        runtimeContext
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('404s (Agent not found) when the agent does not exist', async () => {
      mockReq.body = { agentId: 'agent_1' };
      agentRepository.findById.mockResolvedValue(null);

      await developerThreadController.create(mockReq, mockRes, next);

      expect(threadService.createThread).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Agent not found' }));
    });

    test('404s (Agent not found) when the agent exists but is not executable by this context', async () => {
      mockReq.body = { agentId: 'agent_1' };
      agentRepository.findById.mockResolvedValue({ _id: 'agent_1' });
      agentService.canUserExecuteAgent.mockReturnValue(false);

      await developerThreadController.create(mockReq, mockRes, next);

      expect(threadService.createThread).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Agent not found' }));
    });
  });

  describe('getAll', () => {
    test('lists via threadService.getThreadsForSubject using req.projectContext', async () => {
      threadService.getThreadsForSubject.mockResolvedValue([{ _id: 't1' }]);

      await developerThreadController.getAll(mockReq, mockRes, next);

      expect(threadService.getThreadsForSubject).toHaveBeenCalledWith(
        undefined,
        { page: 1, limit: 20 },
        runtimeContext
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 't1' }] });
    });
  });

  describe('getOne', () => {
    test('returns the Thread using the :threadId param and req.projectContext', async () => {
      mockReq.params = { threadId: 't1' };
      threadService.getThreadById.mockResolvedValue({ _id: 't1' });

      await developerThreadController.getOne(mockReq, mockRes, next);

      expect(threadService.getThreadById).toHaveBeenCalledWith('t1', undefined, runtimeContext);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: { _id: 't1' } });
    });

    test('collapses "Thread not found" to a 404, existence-hiding', async () => {
      mockReq.params = { threadId: 't1' };
      threadService.getThreadById.mockRejectedValue(new Error('Thread not found'));

      await developerThreadController.getOne(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    test('updates title only via threadService.updateThread', async () => {
      mockReq.params = { threadId: 't1' };
      mockReq.body = { title: 'New Title' };
      threadService.updateThread.mockResolvedValue({ _id: 't1' });

      await developerThreadController.update(mockReq, mockRes, next);

      expect(threadService.updateThread).toHaveBeenCalledWith(
        't1',
        undefined,
        { title: 'New Title' },
        runtimeContext
      );
    });

    test('updates isArchived only via threadService.updateThread', async () => {
      mockReq.params = { threadId: 't1' };
      mockReq.body = { isArchived: true };
      threadService.updateThread.mockResolvedValue({ _id: 't1', isArchived: true });

      await developerThreadController.update(mockReq, mockRes, next);

      expect(threadService.updateThread).toHaveBeenCalledWith(
        't1',
        undefined,
        { isArchived: true },
        runtimeContext
      );
    });

    test('updates both title and isArchived together', async () => {
      mockReq.params = { threadId: 't1' };
      mockReq.body = { title: 'New Title', isArchived: false };
      threadService.updateThread.mockResolvedValue({ _id: 't1' });

      await developerThreadController.update(mockReq, mockRes, next);

      expect(threadService.updateThread).toHaveBeenCalledWith(
        't1',
        undefined,
        { title: 'New Title', isArchived: false },
        runtimeContext
      );
    });

    test('collapses "Thread not found" to a 404', async () => {
      mockReq.params = { threadId: 't1' };
      mockReq.body = { title: 'New Title' };
      threadService.updateThread.mockRejectedValue(new Error('Thread not found'));

      await developerThreadController.update(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('remove', () => {
    test('deletes via threadService.deleteThread and cleans up checkpoints', async () => {
      mockReq.params = { threadId: 't1' };
      threadService.deleteThread.mockResolvedValue({ threadId: 'uuid-1' });

      await developerThreadController.remove(mockReq, mockRes, next);

      expect(threadService.deleteThread).toHaveBeenCalledWith('t1', undefined, runtimeContext);
      expect(checkpointService.cleanupThreads).toHaveBeenCalledWith('uuid-1');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Thread deleted successfully',
      });
    });

    test('collapses "Thread not found" to a 404', async () => {
      mockReq.params = { threadId: 't1' };
      threadService.deleteThread.mockRejectedValue(new Error('Thread not found'));

      await developerThreadController.remove(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getMessages', () => {
    test('returns messages via checkpointService.getMessages, forwarding req.projectContext', async () => {
      mockReq.params = { threadId: 't1' };
      checkpointService.getMessages.mockResolvedValue({
        messages: [],
        state: {},
        subagentTraces: {},
      });

      await developerThreadController.getMessages(mockReq, mockRes, next);

      expect(checkpointService.getMessages).toHaveBeenCalledWith('t1', undefined, runtimeContext);
    });

    test('collapses "Unauthorized" to a 404', async () => {
      mockReq.params = { threadId: 't1' };
      checkpointService.getMessages.mockRejectedValue(new Error('Unauthorized'));

      await developerThreadController.getMessages(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
