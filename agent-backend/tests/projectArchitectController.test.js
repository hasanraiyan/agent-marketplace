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

jest.unstable_mockModule('../src/modules/threads/thread.model.js', () => ({
  default: {
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: { checkpointer: { getTuple: jest.fn() } },
}));

const rateLimiterService = (await import('../src/modules/rateLimiter/rateLimiter.service.js'))
  .default;
const aguiService = await import('../src/modules/agui/agui.service.js');
const Conversation = (await import('../src/modules/threads/thread.model.js')).default;
const { PROJECT_ARCHITECT_AGENT_ID } = await import('../src/modules/agents/architectConstants.js');
const projectArchitectController = (
  await import('../src/modules/projects/projectArchitect.controller.js')
).default;

/**
 * `projectArchitect.controller.js`'s `runAgent` used to always run against
 * one hardcoded `architect-${domain}` LangGraph thread — this suite covers
 * the new per-thread resolution (mirrors `projectAgentTest.controller.js`'s
 * already-established pattern for real Agents), which is genuinely new
 * logic, not a rename.
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

describe('ProjectArchitectController.runAgent — thread resolution', () => {
  const domain = 'project_1';
  const context = { domain, principalType: 'ProjectAdmin', personaUserId: 'user_1' };

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimiterService.getConcurrency.mockReturnValue(0);
    aguiService.readJsonBody.mockResolvedValue({ messages: [] });
    aguiService.runAgentAsAguiEvents.mockImplementation(async function* () {});
  });

  test('falls back to the deterministic architect-${domain} thread when no thread id is requested', async () => {
    Conversation.findOne.mockResolvedValue(null);
    const req = { headers: {}, projectAdminContext: context, on: jest.fn() };
    const res = fakeRes();

    await projectArchitectController.runAgent(req, res, jest.fn());

    const events = eventsOf(res);
    expect(events[0]).toMatchObject({ type: 'RUN_STARTED', threadId: `architect-${domain}` });
    expect(aguiService.runAgentAsAguiEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: PROJECT_ARCHITECT_AGENT_ID,
        langGraphThreadId: `architect-${domain}`,
        threadDbId: undefined,
      })
    );
  });

  test('resolves an explicit x-thread-id to its own Conversation and langGraphThreadId', async () => {
    const conversationObjectId = '507f1f77bcf86cd799439011';
    const resolved = { _id: conversationObjectId, threadId: `architect-${domain}-abc` };
    Conversation.findOne.mockResolvedValue(resolved);
    const req = {
      headers: { 'x-thread-id': conversationObjectId },
      projectAdminContext: context,
      on: jest.fn(),
    };
    const res = fakeRes();

    await projectArchitectController.runAgent(req, res, jest.fn());

    expect(Conversation.findOne).toHaveBeenCalledWith({
      _id: conversationObjectId,
      domain,
      agentId: PROJECT_ARCHITECT_AGENT_ID,
    });
    const events = eventsOf(res);
    expect(events[0]).toMatchObject({ type: 'RUN_STARTED', threadId: `architect-${domain}-abc` });
    expect(aguiService.runAgentAsAguiEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        langGraphThreadId: `architect-${domain}-abc`,
        threadDbId: conversationObjectId,
      })
    );
  });

  test('an unresolvable requested thread id falls back to the deterministic default', async () => {
    Conversation.findOne
      .mockResolvedValueOnce(null) // the explicit lookup misses
      .mockResolvedValueOnce({ _id: 'conv-default' }); // the default-id lookup hits
    const req = {
      headers: { 'x-thread-id': 'does-not-exist' },
      projectAdminContext: context,
      on: jest.fn(),
    };
    const res = fakeRes();

    await projectArchitectController.runAgent(req, res, jest.fn());

    const events = eventsOf(res);
    expect(events[0]).toMatchObject({ type: 'RUN_STARTED', threadId: `architect-${domain}` });
  });

  test('"default"/"new" thread id values are treated as no explicit thread', async () => {
    Conversation.findOne.mockResolvedValue(null);
    const req = {
      headers: { 'x-thread-id': 'default' },
      projectAdminContext: context,
      on: jest.fn(),
    };
    const res = fakeRes();

    await projectArchitectController.runAgent(req, res, jest.fn());

    // Only ever looked up the default id's own Conversation, never treated
    // "default" itself as a real thread id to search for.
    expect(Conversation.findOne).toHaveBeenCalledTimes(1);
    expect(Conversation.findOne).toHaveBeenCalledWith({
      domain,
      agentId: PROJECT_ARCHITECT_AGENT_ID,
      threadId: `architect-${domain}`,
    });
  });
});
