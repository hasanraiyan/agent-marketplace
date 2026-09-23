import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/rateLimiter/rateLimiter.service.js', () => ({
  default: {
    getConcurrency: jest.fn().mockReturnValue(0),
    incrementConcurrency: jest.fn(),
    decrementConcurrency: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agui/agui.service.js', () => ({
  readJsonBody: jest.fn(),
  // eslint-disable-next-line require-yield
  runAgentAsAguiEvents: jest.fn(async function* () {}),
}));

jest.unstable_mockModule('../src/modules/threads/thread.service.js', () => ({
  default: { getThreadById: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: { touchLastMessageAt: jest.fn(), update: jest.fn().mockResolvedValue(undefined) },
}));

jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: { checkpointer: { getTuple: jest.fn() } },
}));

const rateLimiterService = (await import('../src/modules/rateLimiter/rateLimiter.service.js'))
  .default;
const aguiService = await import('../src/modules/agui/agui.service.js');
const threadService = (await import('../src/modules/threads/thread.service.js')).default;
const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const { DEVELOPER_ARCHITECT_AGENT_ID } =
  await import('../src/modules/agents/architectConstants.js');
const developerArchitectController = (
  await import('../src/modules/developer/developerArchitect.controller.js')
).default;

/**
 * developerArchitect.controller.js's `runAgent` used to always run against
 * one hardcoded `architect-${scopeKey}` LangGraph thread, with no way to
 * resume a specific named conversation — unlike projectArchitect.
 * controller.js's real per-thread resolution. This covers the new
 * resolution logic, scoped to ProjectRuntimeContext only (a bare
 * ProjectMachineContext has no Subject for thread.service.js to resolve a
 * Thread against, mirroring developerThread.routes.js's own restriction).
 */
function fakeRes() {
  const writes = [];
  return {
    writes,
    destroyed: false,
    status: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk) => writes.push(chunk)),
    on: jest.fn(),
    end: jest.fn(),
  };
}

function eventsOf(res) {
  return res.writes.map((w) => JSON.parse(w.replace(/^data: /, '').trim()));
}

describe('DeveloperArchitectController.runAgent — thread resolution', () => {
  const domain = 'project_1';
  const externalUserId = 'ext_user_1';
  const runtimeContext = { domain, principalType: 'ProjectRuntime', externalUserId };
  const machineContext = { domain, principalType: 'ProjectMachine' };

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimiterService.getConcurrency.mockReturnValue(0);
    aguiService.readJsonBody.mockResolvedValue({ messages: [] });
    aguiService.runAgentAsAguiEvents.mockImplementation(async function* () {});
  });

  test('bare ProjectMachineContext uses the deterministic project-wide thread, ignoring any x-thread-id', async () => {
    const req = {
      headers: { 'x-thread-id': 'some-thread' },
      projectContext: machineContext,
      on: jest.fn(),
    };
    const res = fakeRes();

    await developerArchitectController.runAgent(req, res, jest.fn());

    expect(threadService.getThreadById).not.toHaveBeenCalled();
    const events = eventsOf(res);
    expect(events[0]).toMatchObject({
      type: 'RUN_STARTED',
      threadId: `architect-${domain}:project`,
    });
    expect(aguiService.runAgentAsAguiEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        langGraphThreadId: `architect-${domain}:project`,
        threadDbId: undefined,
      })
    );
  });

  test('ProjectRuntimeContext with no thread id uses its own deterministic per-external-user thread', async () => {
    const req = { headers: {}, projectContext: runtimeContext, on: jest.fn() };
    const res = fakeRes();

    await developerArchitectController.runAgent(req, res, jest.fn());

    expect(threadService.getThreadById).not.toHaveBeenCalled();
    const events = eventsOf(res);
    expect(events[0]).toMatchObject({
      type: 'RUN_STARTED',
      threadId: `architect-${domain}:${externalUserId}`,
    });
  });

  test('ProjectRuntimeContext with a resolvable x-thread-id for the Architect sentinel resumes it', async () => {
    const threadDbId = '507f1f77bcf86cd799439011';
    threadService.getThreadById.mockResolvedValue({
      _id: threadDbId,
      threadId: 'architect-thread-abc',
      agentId: DEVELOPER_ARCHITECT_AGENT_ID,
    });
    const req = {
      headers: { 'x-thread-id': threadDbId },
      projectContext: runtimeContext,
      on: jest.fn(),
    };
    const res = fakeRes();

    await developerArchitectController.runAgent(req, res, jest.fn());

    expect(threadService.getThreadById).toHaveBeenCalledWith(threadDbId, undefined, runtimeContext);
    expect(threadRepository.touchLastMessageAt).toHaveBeenCalledWith(threadDbId);
    const events = eventsOf(res);
    expect(events[0]).toMatchObject({ type: 'RUN_STARTED', threadId: 'architect-thread-abc' });
    expect(aguiService.runAgentAsAguiEvents).toHaveBeenCalledWith(
      expect.objectContaining({ langGraphThreadId: 'architect-thread-abc', threadDbId })
    );
  });

  test('a resolvable but populated-different-agent thread is rejected as not found', async () => {
    threadService.getThreadById.mockResolvedValue({
      _id: 'thread_1',
      threadId: 'agui-thread-xyz',
      agentId: { _id: 'some-other-agent-id' },
    });
    const req = {
      headers: { 'x-thread-id': 'thread_1' },
      projectContext: runtimeContext,
      on: jest.fn(),
    };
    const res = fakeRes();
    const next = jest.fn();

    await developerArchitectController.runAgent(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Thread not found' }));
    expect(aguiService.runAgentAsAguiEvents).not.toHaveBeenCalled();
  });

  test('an unresolvable x-thread-id is rejected as not found, never silently falling back', async () => {
    threadService.getThreadById.mockRejectedValue(new Error('Thread not found'));
    const req = {
      headers: { 'x-thread-id': 'does-not-exist' },
      projectContext: runtimeContext,
      on: jest.fn(),
    };
    const res = fakeRes();
    const next = jest.fn();

    await developerArchitectController.runAgent(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Thread not found' }));
    expect(aguiService.runAgentAsAguiEvents).not.toHaveBeenCalled();
  });
});
