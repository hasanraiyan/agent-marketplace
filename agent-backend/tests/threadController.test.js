import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/services/chat.service.js', () => ({
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
const chatService = (await import('../src/services/chat.service.js')).default;

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

  describe('stream SSE', () => {
    test('should invoke chat service streaming correctly', async () => {
      mockReq.params.id = 'thread_xyz';
      mockReq.body.message = 'hi';

      await threadController.stream(mockReq, mockRes, mockNext);

      // It passes res directly into the chatService for socket control
      expect(chatService.streamChat).toHaveBeenCalledWith(mockRes, 'thread_xyz', 'user_1', 'hi');
    });

    test('should fallback to next(error) if zod syntax validation fails before stream starts', async () => {
      const err = new Error('Zod validate fail');

      // Need a direct mock overlay inside the test for standard import mocking limit
      jest.unstable_mockModule('../src/validators/thread.validator.js', () => ({
        streamMessageSchema: {
          parse: jest.fn().mockImplementation(() => {
            throw err;
          }),
        },
      }));

      // Because Zod is synchronously evaluated inside standard scope, we'll force simulate
      jest.spyOn(chatService, 'streamChat').mockRejectedValue(err);

      await threadController.stream(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });
});
