import { jest } from '@jest/globals';
import NotFoundError from '../src/utils/errors/NotFoundError.js';

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

jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: {
    findById: jest.fn(),
    touchLastMessageAt: jest.fn(),
    update: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/thread.service.js', () => ({
  default: {
    getThreadById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: {
    checkpointer: {},
    _autoTitleThread: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agui/aguiTranslator.js', () => ({
  translateLangGraphStream: jest.fn(async function* () {}),
  emitTextNotice: jest.fn(async function* (msg) {
    yield { type: 'text', content: msg };
  }),
  formatRuntimeError: jest.fn((err) => err.message),
  classifyRuntimeError: jest.fn(() => ({ code: 'INTERNAL_ERROR', retryable: false })),
  buildResumeValue: jest.fn(),
  describeInterrupt: jest.fn(),
}));

const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const threadService = (await import('../src/modules/threads/thread.service.js')).default;
const developerAguiController = (
  await import('../src/modules/developer/developerAgui.controller.js')
).default;

describe('Developer AG-UI Controller — runAgent', () => {
  let mockReq;
  let mockRes;
  let next;

  const runtimeContext = {
    domain: 'project-1',
    principalType: 'ProjectRuntime',
    credentialId: 'cred-1',
    externalUserId: 'sabik',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      projectContext: runtimeContext,
      headers: { 'x-agent-id': 'agent-1' },
      query: {},
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }));
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

  test('rejects a ProjectMachineContext (no asserted external user) with 400 BEFORE any agent lookup', async () => {
    mockReq.projectContext = { domain: 'project-1', principalType: 'ProjectMachine' };

    await developerAguiController.runAgent(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, code: 'EXTERNAL_USER_REQUIRED' })
    );
    expect(agentRepository.findById).not.toHaveBeenCalled();
    expect(mockRes.setHeader).not.toHaveBeenCalled();
  });

  test('rejects the Architect sentinel agentId as not-found, never reaching agent lookup', async () => {
    mockReq.headers['x-agent-id'] = '000000000000000000000000';

    await developerAguiController.runAgent(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    expect(agentRepository.findById).not.toHaveBeenCalled();
  });

  test('rejects when x-agent-id is missing', async () => {
    delete mockReq.headers['x-agent-id'];

    await developerAguiController.runAgent(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  test('rejects a cross-Domain agent as not-found, before setting SSE headers', async () => {
    agentRepository.findById.mockResolvedValue({
      _id: 'agent-1',
      domain: 'a-different-project',
      visibility: 'public',
      isActive: true,
      deletedAt: null,
    });

    await developerAguiController.runAgent(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    expect(mockRes.setHeader).not.toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream; charset=utf-8'
    );
  });

  test('runs a matching-Domain public Agent end-to-end, using the Domain-extended deterministic thread id', async () => {
    agentRepository.findById.mockResolvedValue({
      _id: 'agent-1',
      domain: 'project-1',
      visibility: 'public',
      isActive: true,
      deletedAt: null,
    });
    agentFactory.buildAgent.mockResolvedValue({
      agentInstance: {
        getState: jest.fn().mockResolvedValue({ tasks: [] }),
        streamEvents: jest.fn().mockReturnValue((async function* () {})()),
      },
      agentConfig: {},
      providerConfig: {},
      llm: {},
      mcpAppMap: {},
    });

    await developerAguiController.runAgent(mockReq, mockRes, next);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream; charset=utf-8'
    );
    expect(agentFactory.buildAgent).toHaveBeenCalledWith(
      'agent-1',
      'sabik',
      expect.anything(),
      runtimeContext
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('"threadId":"agui-project-1-agent-1-sabik"')
    );
  });

  test('two different Projects with the same externalUserId get different deterministic thread ids', async () => {
    agentRepository.findById.mockResolvedValue({
      _id: 'agent-1',
      domain: 'project-2',
      visibility: 'public',
      isActive: true,
      deletedAt: null,
    });
    agentFactory.buildAgent.mockResolvedValue({
      agentInstance: {
        getState: jest.fn().mockResolvedValue({ tasks: [] }),
        streamEvents: jest.fn().mockReturnValue((async function* () {})()),
      },
      agentConfig: {},
      providerConfig: {},
      llm: {},
      mcpAppMap: {},
    });
    mockReq.projectContext = {
      domain: 'project-2',
      principalType: 'ProjectRuntime',
      credentialId: 'cred-2',
      externalUserId: 'sabik', // same raw externalUserId as the previous test's Project
    };

    await developerAguiController.runAgent(mockReq, mockRes, next);

    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('"threadId":"agui-project-2-agent-1-sabik"')
    );
  });

  describe('Thread resume (blueprint Phase 9, PR-41)', () => {
    beforeEach(() => {
      agentRepository.findById.mockResolvedValue({
        _id: 'agent-1',
        domain: 'project-1',
        visibility: 'public',
        isActive: true,
        deletedAt: null,
      });
      agentFactory.buildAgent.mockResolvedValue({
        agentInstance: {
          getState: jest.fn().mockResolvedValue({ tasks: [] }),
          streamEvents: jest.fn().mockReturnValue((async function* () {})()),
        },
        agentConfig: {},
        providerConfig: {},
        llm: {},
        mcpAppMap: {},
      });
    });

    test('resumes a matching-Subject, matching-Agent Thread via x-thread-id', async () => {
      mockReq.headers['x-thread-id'] = 'thread-mongo-id-1';
      threadService.getThreadById.mockResolvedValue({
        _id: 'thread-mongo-id-1',
        threadId: 'real-langgraph-thread-uuid',
        agentId: 'agent-1',
      });

      await developerAguiController.runAgent(mockReq, mockRes, next);

      expect(threadService.getThreadById).toHaveBeenCalledWith(
        'thread-mongo-id-1',
        undefined,
        runtimeContext
      );
      expect(threadRepository.touchLastMessageAt).toHaveBeenCalledWith('thread-mongo-id-1');
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"threadId":"real-langgraph-thread-uuid"')
      );
    });

    test('rejects with a 404 when the Thread belongs to a different Agent, BEFORE setting SSE headers', async () => {
      mockReq.headers['x-thread-id'] = 'thread-mongo-id-1';
      threadService.getThreadById.mockResolvedValue({
        _id: 'thread-mongo-id-1',
        threadId: 'real-langgraph-thread-uuid',
        agentId: 'a-different-agent',
      });

      await developerAguiController.runAgent(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(threadRepository.touchLastMessageAt).not.toHaveBeenCalled();
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream; charset=utf-8'
      );
    });

    test("rejects with a 404 when the Thread is not this Subject's, BEFORE setting SSE headers", async () => {
      mockReq.headers['x-thread-id'] = 'thread-mongo-id-1';
      threadService.getThreadById.mockRejectedValue(new Error('Thread not found'));

      await developerAguiController.runAgent(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(threadRepository.touchLastMessageAt).not.toHaveBeenCalled();
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream; charset=utf-8'
      );
    });

    test('omitting x-thread-id keeps the deterministic id and never calls threadService.getThreadById', async () => {
      await developerAguiController.runAgent(mockReq, mockRes, next);

      expect(threadService.getThreadById).not.toHaveBeenCalled();
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"threadId":"agui-project-1-agent-1-sabik"')
      );
    });
  });
});
