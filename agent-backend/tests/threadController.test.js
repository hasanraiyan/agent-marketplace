import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/services/checkpoint.service.js', () => ({
  default: {
    streamChat: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/repositories/threadRepository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByUser: jest.fn(),
    delete: jest.fn(),
    deleteAllByUser: jest.fn(),
    update: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/repositories/agentRepository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/validators/thread.validator.js', () => ({
  createThreadSchema: { parse: jest.fn().mockImplementation((data) => data) },
  updateThreadTitleSchema: { parse: jest.fn().mockImplementation((data) => data) },
  streamMessageSchema: { parse: jest.fn().mockImplementation((data) => data) },
}));

const threadController = (await import('../src/controllers/thread.controller.js')).default;
const threadRepository = (await import('../src/repositories/threadRepository.js')).default;
const agentRepository = (await import('../src/repositories/agentRepository.js')).default;
const checkpointService = (await import('../src/services/checkpoint.service.js')).default;

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
    });

    test('should create thread correctly', async () => {
      mockReq.body.agentId = 'agent_1';
      agentRepository.findById.mockResolvedValue({ _id: 'agent_1' });
      threadRepository.create.mockResolvedValue({ _id: 'thread_xyz' });

      await threadController.create(mockReq, mockRes, mockNext);

      expect(threadRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent_1',
          userId: 'user_1',
          threadId: expect.any(String),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });


  describe('delete all threads', () => {
    test('should delete all threads for user', async () => {
      threadRepository.deleteAllByUser.mockResolvedValue({ deletedCount: 5 });

      await threadController.deleteAll(mockReq, mockRes, mockNext);

      expect(threadRepository.deleteAllByUser).toHaveBeenCalledWith('user_1');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'All threads permanently removed',
      });
    });

    test('should pass error to next if repository fails', async () => {
      const err = new Error('Database connection failed');
      threadRepository.deleteAllByUser.mockRejectedValue(err);

      await threadController.deleteAll(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });
});
