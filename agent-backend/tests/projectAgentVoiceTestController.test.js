import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/agents/agent.service.js', () => ({
  default: { getDeveloperAgentById: jest.fn() },
  personaExecutionContext: jest.fn(),
}));
jest.unstable_mockModule('../src/modules/voice/voice.service.js', () => ({
  resolveVoiceProvider: jest.fn(),
  buildVoiceLiveConfig: jest.fn(),
}));
jest.unstable_mockModule('../src/modules/voice/voiceTicket.service.js', () => ({
  mintVoiceTicket: jest.fn(),
}));
jest.unstable_mockModule('../src/modules/threads/thread.model.js', () => ({
  default: { findOne: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: { touchLastMessageAt: jest.fn() },
}));

const agentService = (await import('../src/modules/agents/agent.service.js')).default;
const { resolveVoiceProvider, buildVoiceLiveConfig } =
  await import('../src/modules/voice/voice.service.js');
const { mintVoiceTicket } = await import('../src/modules/voice/voiceTicket.service.js');
const Conversation = (await import('../src/modules/threads/thread.model.js')).default;
const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const projectAgentVoiceTestController = (
  await import('../src/modules/voice/projectAgentVoiceTest.controller.js')
).default;

/**
 * projectAgentVoiceTest.controller.js used to always mint a ticket with
 * `threadId: null` — a fresh scratch conversation every time, unlike
 * developerVoice.controller.js's real `x-thread-id` resolution. This
 * covers the new resolution logic only (agent lookup / provider / voice
 * config are heavily mocked — they're unrelated to this fix).
 */
describe('ProjectAgentVoiceTestController.createSession — thread resolution', () => {
  const domain = 'project_1';
  const personaUserId = 'admin_1';
  const agentId = 'agent_1';
  const context = { domain, principalType: 'ProjectAdmin', personaUserId, membershipRole: 'Admin' };

  function fakeReqRes(headers = {}) {
    return {
      req: {
        projectAdminContext: context,
        params: { agentId },
        body: {},
        headers,
        query: {},
        protocol: 'https',
        get: () => 'example.com',
      },
      res: { json: jest.fn() },
      next: jest.fn(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    agentService.getDeveloperAgentById.mockResolvedValue({ _id: agentId, interruptOn: {} });
    resolveVoiceProvider.mockResolvedValue({ id: 'provider_1', label: 'Gemini' });
    buildVoiceLiveConfig.mockResolvedValue({ model: 'gemini-live', voiceName: 'Puck' });
    mintVoiceTicket.mockReturnValue({ ticket: 't', expiresAt: new Date() });
  });

  test('no x-thread-id header: mints with threadId null (unchanged default behavior)', async () => {
    const { req, res, next } = fakeReqRes();

    await projectAgentVoiceTestController.createSession(req, res, next);

    expect(Conversation.findOne).not.toHaveBeenCalled();
    expect(mintVoiceTicket).toHaveBeenCalledWith(expect.objectContaining({ threadId: null }));
    expect(next).not.toHaveBeenCalled();
  });

  test('a resolvable x-thread-id header: mints with the resolved LangGraph thread id', async () => {
    Conversation.findOne.mockResolvedValue({
      _id: 'conv_1',
      threadId: 'agent-test-project_1-agent_1-abc',
    });
    const { req, res, next } = fakeReqRes({ 'x-thread-id': 'agent-test-project_1-agent_1-abc' });

    await projectAgentVoiceTestController.createSession(req, res, next);

    expect(Conversation.findOne).toHaveBeenCalledWith({
      threadId: 'agent-test-project_1-agent_1-abc',
      domain,
      agentId,
      userId: personaUserId,
    });
    expect(threadRepository.touchLastMessageAt).toHaveBeenCalledWith('conv_1');
    expect(mintVoiceTicket).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'agent-test-project_1-agent_1-abc' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('an unresolvable x-thread-id header: rejects with a generic not-found error', async () => {
    Conversation.findOne.mockResolvedValue(null);
    const { req, res, next } = fakeReqRes({ 'x-thread-id': 'does-not-exist' });

    await projectAgentVoiceTestController.createSession(req, res, next);

    expect(mintVoiceTicket).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Thread not found' }));
  });

  test('an ObjectId-shaped x-thread-id queries by _id instead of threadId', async () => {
    const objectId = '507f1f77bcf86cd799439011';
    Conversation.findOne.mockResolvedValue({
      _id: objectId,
      threadId: 'agent-test-project_1-agent_1-xyz',
    });
    const { req, res, next } = fakeReqRes({ 'x-thread-id': objectId });

    await projectAgentVoiceTestController.createSession(req, res, next);

    expect(Conversation.findOne).toHaveBeenCalledWith({
      _id: objectId,
      domain,
      agentId,
      userId: personaUserId,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
