import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: { findById: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/agents/agent.service.js', () => ({
  default: { canUserExecuteAgent: jest.fn() },
  personaExecutionContext: jest.fn(),
}));

jest.unstable_mockModule('../src/modules/voice/voice.service.js', () => ({
  resolveVoiceProvider: jest.fn(),
  buildVoiceLiveConfig: jest.fn(),
}));

jest.unstable_mockModule('../src/modules/voice/voiceTicket.service.js', () => ({
  mintVoiceTicket: jest.fn(),
}));

jest.unstable_mockModule('../src/modules/threads/thread.service.js', () => ({
  default: { getThreadById: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: { touchLastMessageAt: jest.fn() },
}));

const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentService = (await import('../src/modules/agents/agent.service.js')).default;
const { resolveVoiceProvider, buildVoiceLiveConfig } =
  await import('../src/modules/voice/voice.service.js');
const { mintVoiceTicket } = await import('../src/modules/voice/voiceTicket.service.js');
const developerVoiceController = (
  await import('../src/modules/voice/developerVoice.controller.js')
).default;

describe('DeveloperVoiceController.createTelephonySession', () => {
  const context = {
    principalType: 'ProjectRuntime',
    domain: 'project_1',
    credentialId: 'cred_1',
    externalUserId: 'user_2ab',
  };

  function fakeReqRes({ body = {}, headers = {} } = {}) {
    return {
      req: {
        projectContext: context,
        body,
        headers: { 'x-agent-id': 'agent_1', ...headers },
        query: {},
        protocol: 'https',
        get: () => 'api.example.com',
      },
      res: { json: jest.fn() },
      next: jest.fn(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    agentRepository.findById.mockResolvedValue({
      _id: 'agent_1',
      domain: 'project_1',
      populate: jest.fn().mockResolvedValue(undefined),
    });
    agentService.canUserExecuteAgent.mockReturnValue(true);
    mintVoiceTicket.mockReturnValue({
      ticket: 'payload.signature',
      expiresAt: '2026-01-01T00:01:00.000Z',
    });
  });

  test('mints a telephony ticket bound to the asserted user, not the phone number', async () => {
    const { req, res, next } = fakeReqRes({
      body: { from: 'whatsapp:+919876543210', to: '+14155238886', callSid: 'CA123' },
    });

    await developerVoiceController.createTelephonySession(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mintVoiceTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        principalType: 'ProjectRuntime',
        audience: 'telephony',
        domain: 'project_1',
        agentId: 'agent_1',
        subjectId: 'user_2ab',
        credentialId: 'cred_1',
        threadId: 'agui-project_1-agent_1-user_2ab',
        telephony: {
          channel: 'voice',
          from: '+919876543210',
          to: '+14155238886',
          callSid: 'CA123',
        },
        context: expect.objectContaining({ callerPhone: '+919876543210', callSid: 'CA123' }),
      })
    );

    const payload = res.json.mock.calls[0][0];
    expect(payload.data.ticket).toBe('payload.signature');
    expect(payload.data.streamUrl).toContain('/api/v1/twilio/media-stream?ticket=');
    expect(payload.data.expiresAt).toBe('2026-01-01T00:01:00.000Z');
    // No model/voice on this path — the gateway resolves them at redeem.
    expect(payload.data.session).toBeUndefined();
  });

  test('does not resolve a Gemini provider at mint time (fast Twilio webhook path)', async () => {
    const { req, res, next } = fakeReqRes({ body: { from: '+919876543210' } });

    await developerVoiceController.createTelephonySession(req, res, next);

    expect(resolveVoiceProvider).not.toHaveBeenCalled();
    expect(buildVoiceLiveConfig).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a credential with no asserted external user', async () => {
    const { req, res, next } = fakeReqRes();
    req.projectContext = {
      principalType: 'ProjectMachine',
      domain: 'project_1',
      credentialId: 'cred_1',
    };

    await developerVoiceController.createTelephonySession(req, res, next);

    expect(mintVoiceTicket).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EXTERNAL_USER_REQUIRED', statusCode: 400 })
    );
  });

  test('rejects an agent the Project cannot execute', async () => {
    agentService.canUserExecuteAgent.mockReturnValue(false);
    const { req, res, next } = fakeReqRes();

    await developerVoiceController.createTelephonySession(req, res, next);

    expect(mintVoiceTicket).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});
