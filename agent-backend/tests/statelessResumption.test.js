import { jest } from '@jest/globals';
import { HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';

// Mocking dependencies
jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: {
    findById: jest.fn(),
    touchLastMessageAt: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: {
    buildAgent: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: {
    checkpointer: {},
    _autoTitleThread: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agui/aguiTranslator.js', () => ({
  translateLangGraphStream: jest.fn(),
  emitTextNotice: jest.fn(),
  formatRuntimeError: jest.fn((err) => err.message),
  classifyRuntimeError: jest.fn(() => ({ code: 'INTERNAL_ERROR', retryable: false })),
  buildResumeValue: jest.fn((pending, resume, content) => content),
  describeInterrupt: jest.fn((interrupts) => ({ kind: 'hitl', actionCount: interrupts.length })),
}));

// Mock Clerk express middleware
jest.unstable_mockModule('@clerk/express', () => ({
  clerkMiddleware: () => (req, res, next) => next(),
  getAuth: () => ({ userId: 'user_1' }),
}));

// Mock authMiddleware
jest.unstable_mockModule('../src/modules/auth/auth.middleware.js', () => ({
  default: (req, res, next) => {
    req.user = { _id: 'user_1' };
    next();
  },
}));

const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const aguiRouterModule = await import('../src/modules/agui/agui.routes.js');
const aguiRouter = aguiRouterModule.default;

describe('Stateless Resumption Logic in agui.routes.js', () => {
  let mockAgentInstance;
  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    agentRepository.findById.mockResolvedValue({
      _id: 'agent_1',
      ownerId: 'user_1',
      visibility: 'public',
      isActive: true,
      deletedAt: null,
    });
    mockAgentInstance = {
      getState: jest.fn(),
      streamEvents: jest.fn().mockReturnValue((async function* () {})()),
    };
    agentFactory.buildAgent.mockResolvedValue({
      agentInstance: mockAgentInstance,
      providerConfig: {},
      llm: {},
    });
    threadRepository.findById.mockResolvedValue({
      _id: 'thread_1',
      threadId: 'uuid_1',
      userId: 'user_1',
      agentId: 'agent_1',
      title: 'Existing Conversation',
    });

    mockReq = {
      method: 'POST',
      headers: {
        'x-agent-id': 'agent_1',
        'x-thread-id': 'thread_1',
      },
      user: { _id: 'user_1' },
      body: {
        messages: [{ role: 'user', content: 'Approve' }],
      },
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(JSON.stringify(this.body));
      },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      write: jest.fn(),
      end: jest.fn(),
      flushHeaders: jest.fn(),
      on: jest.fn(),
    };
    next = jest.fn();
  });

  test('should detect pending interrupt from state and resume', async () => {
    mockAgentInstance.getState.mockResolvedValue({
      tasks: [
        {
          interrupts: [{ value: { actionRequests: [{ name: 'test_tool' }] } }],
        },
      ],
    });

    const middleware = aguiRouter.stack.find((s) => s.handle?.length === 3).handle;
    await middleware(mockReq, mockRes, next);

    // Finding the rateLimiter middleware and skip it
    // The stack looks like: [rateLimiter, postHandler]
    const routeStack = aguiRouter.stack.find((s) => s.route?.methods.post).route.stack;
    const postHandler = routeStack[routeStack.length - 1].handle;

    await postHandler(mockReq, mockRes, next);

    expect(mockAgentInstance.getState).toHaveBeenCalledWith({
      configurable: { thread_id: 'uuid_1' },
    });

    expect(mockAgentInstance.streamEvents).toHaveBeenCalledWith(
      expect.any(Command),
      expect.objectContaining({
        configurable: { thread_id: 'uuid_1' },
      })
    );

    const firstArg = mockAgentInstance.streamEvents.mock.calls[0][0];
    expect(firstArg).toBeInstanceOf(Command);
    expect(firstArg.resume).toBeDefined();
  });

  test('should start fresh if no pending interrupt is found in state', async () => {
    mockAgentInstance.getState.mockResolvedValue({
      tasks: [],
    });

    const middleware = aguiRouter.stack.find((s) => s.handle?.length === 3).handle;
    await middleware(mockReq, mockRes, next);

    const routeStack = aguiRouter.stack.find((s) => s.route?.methods.post).route.stack;
    const postHandler = routeStack[routeStack.length - 1].handle;

    await postHandler(mockReq, mockRes, next);

    expect(mockAgentInstance.streamEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [expect.any(HumanMessage)],
      }),
      expect.objectContaining({
        configurable: { thread_id: 'uuid_1' },
      })
    );

    const firstArg = mockAgentInstance.streamEvents.mock.calls[0][0];
    expect(firstArg).not.toBeInstanceOf(Command);
  });
});
