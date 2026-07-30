import { jest } from '@jest/globals';

/**
 * Developer Platform PR-15 (blueprint §33 architecture debt, Phase 6):
 * closes the known gap where `thread.agentId` was never compared to the
 * requested `x-agent-id` header. Without this check, a caller could resume
 * a thread's checkpoint history under a different agent's config just by
 * sending a different x-agent-id. Mirrors the middleware-extraction pattern
 * from statelessResumption.test.js.
 */
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
  buildResumeValue: jest.fn(),
  describeInterrupt: jest.fn(),
}));

jest.unstable_mockModule('../src/modules/auth/auth.middleware.js', () => ({
  default: (req, res, next) => {
    req.user = { _id: 'user_1' };
    next();
  },
}));

const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const aguiRouterModule = await import('../src/modules/agui/agui.routes.js');
const aguiRouter = aguiRouterModule.default;

function getContextMiddleware() {
  return aguiRouter.stack.find((s) => s.handle?.length === 3).handle;
}

describe('AG-UI thread resolution — thread.agentId verified against x-agent-id', () => {
  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      method: 'POST',
      headers: {
        'x-agent-id': 'agent_1',
        'x-thread-id': 'thread_1',
      },
      query: {},
      user: undefined,
    };
    mockRes = {};
    next = jest.fn();
  });

  test('uses the thread when agentId and userId both match (agentId comes back POPULATED, not a bare string)', async () => {
    // thread.repository.js's findById always does
    // `.populate('agentId', 'name avatar slug')` — a bare-string mock here
    // (as this test used before PR-42) doesn't reflect real Mongoose
    // behavior and would have hidden the exact bug PR-42 fixed.
    threadRepository.findById.mockResolvedValue({
      _id: 'thread_1',
      threadId: 'uuid_1',
      userId: 'user_1',
      agentId: { _id: 'agent_1', name: 'Test Agent', slug: 'test-agent' },
    });

    const middleware = getContextMiddleware();
    await middleware(mockReq, mockRes, next);

    expect(mockReq.aguiContext.langGraphThreadId).toBe('uuid_1');
    expect(threadRepository.touchLastMessageAt).toHaveBeenCalledWith('thread_1');
  });

  test('falls back to a deterministic thread id when the thread belongs to a different agent', async () => {
    threadRepository.findById.mockResolvedValue({
      _id: 'thread_1',
      threadId: 'uuid_1',
      userId: 'user_1',
      // thread was created against a different agent — still populated,
      // matching real findById behavior.
      agentId: { _id: 'agent_2', name: 'A Different Agent', slug: 'a-different-agent' },
    });

    const middleware = getContextMiddleware();
    await middleware(mockReq, mockRes, next);

    expect(mockReq.aguiContext.langGraphThreadId).toBe('agui-agent_1-user_1');
    expect(threadRepository.touchLastMessageAt).not.toHaveBeenCalled();
  });

  test('PR-42 regression guard: a bare (unpopulated) agentId string still matches correctly too', async () => {
    threadRepository.findById.mockResolvedValue({
      _id: 'thread_1',
      threadId: 'uuid_1',
      userId: 'user_1',
      agentId: 'agent_1',
    });

    const middleware = getContextMiddleware();
    await middleware(mockReq, mockRes, next);

    expect(mockReq.aguiContext.langGraphThreadId).toBe('uuid_1');
    expect(threadRepository.touchLastMessageAt).toHaveBeenCalledWith('thread_1');
  });

  test('falls back to a deterministic thread id when the thread belongs to a different user', async () => {
    threadRepository.findById.mockResolvedValue({
      _id: 'thread_1',
      threadId: 'uuid_1',
      userId: 'someone_else',
      agentId: { _id: 'agent_1', name: 'Test Agent', slug: 'test-agent' },
    });

    const middleware = getContextMiddleware();
    await middleware(mockReq, mockRes, next);

    expect(mockReq.aguiContext.langGraphThreadId).toBe('agui-agent_1-user_1');
    expect(threadRepository.touchLastMessageAt).not.toHaveBeenCalled();
  });
});
