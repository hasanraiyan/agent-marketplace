import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { ARCHITECT_AGENT_ID } from '../src/modules/agents/architectConstants.js';

const mockAgentRepository = {
  findById: jest.fn(),
};

const mockExternalUserService = {
  resolveOrCreate: jest.fn(),
};

const mockProjectCredentialRepository = {
  findByProject: jest.fn(),
};

const mockVoiceService = {
  resolveVoiceProvider: jest.fn(),
  buildVoiceLiveConfig: jest.fn(),
};

const mockVoiceThreadService = {
  buildSeedSuffix: jest.fn(),
};

let lastVoiceSessionInstance = null;
const mockVoiceSessionConstructor = jest.fn(function (params) {
  this.params = params;
  this.start = jest.fn().mockResolvedValue(undefined);
  lastVoiceSessionInstance = this;
});

let lastTransportInstance = null;
class MockTwilioVoiceTransport extends EventEmitter {
  constructor({ twilioWs }) {
    super();
    this.twilioWs = twilioWs;
    this.close = jest.fn((code, reason) => {
      this.closeCode = code;
      this.closeReason = reason;
      this.emit('close', code, reason);
    });
    lastTransportInstance = this;
  }
}

let lastSinkInstance = null;
const mockVoiceTranscriptSinkConstructor = jest.fn(function (sinkArgs) {
  this.sinkArgs = sinkArgs;
  this.commit = jest.fn();
  this.flush = jest.fn().mockResolvedValue(undefined);
  lastSinkInstance = this;
});

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: mockAgentRepository,
}));

jest.unstable_mockModule('../src/modules/externalUsers/externalUser.service.js', () => ({
  default: mockExternalUserService,
}));

jest.unstable_mockModule('../src/modules/projects/projectCredential.repository.js', () => ({
  default: mockProjectCredentialRepository,
}));

jest.unstable_mockModule('../src/modules/voice/voice.service.js', () => ({
  resolveVoiceProvider: mockVoiceService.resolveVoiceProvider,
  buildVoiceLiveConfig: mockVoiceService.buildVoiceLiveConfig,
  default: mockVoiceService,
}));

jest.unstable_mockModule('../src/modules/voice/voiceThread.service.js', () => ({
  default: mockVoiceThreadService,
}));

jest.unstable_mockModule('../src/modules/voice/voiceTranscriptSink.js', () => ({
  default: mockVoiceTranscriptSinkConstructor,
}));

jest.unstable_mockModule('../src/modules/voice/gateway/VoiceSession.js', () => ({
  VoiceSession: mockVoiceSessionConstructor,
  default: mockVoiceSessionConstructor,
}));

jest.unstable_mockModule('../src/modules/twilio/TwilioVoiceTransport.js', () => ({
  default: MockTwilioVoiceTransport,
}));

// Ticket signing needs a secret; `.env.test` doesn't set one, and config is
// loaded before this module body runs, so set it on the already-loaded
// config object (the ticket service reads it lazily at sign time).
const { default: config } = await import('../src/config/index.js');
config.jwt.secret = process.env.JWT_SECRET || 'test-voice-ticket-secret';

const { attachTwilioGateway, handleTwilioUpgrade, TWILIO_WS_PATH } =
  await import('../src/modules/twilio/twilioGateway.js');
const { mintVoiceTicket } = await import('../src/modules/voice/voiceTicket.service.js');

/** Mints a telephony ticket the way developerVoice.controller.js does. */
function mintTicket(overrides = {}) {
  return mintVoiceTicket({
    principalType: 'ProjectRuntime',
    audience: 'telephony',
    domain: 'proj_test',
    agentId: 'agent_123',
    subjectId: '+15551234567',
    credentialId: 'cred_active_1',
    threadId: 'agui-proj_test-agent_123-+15551234567',
    telephony: { channel: 'voice', from: '+15551234567', callSid: 'CA_CALL_1' },
    context: { callerPhone: '+15551234567', channel: 'voice' },
    ...overrides,
  }).ticket;
}

function upgradeUrl(ticket) {
  return `${TWILIO_WS_PATH}?ticket=${encodeURIComponent(ticket)}`;
}

describe('Twilio Gateway Unit Tests', () => {
  let mockWss;
  let mockSocket;
  let mockHead;
  let mockTwilioWs;

  beforeEach(() => {
    jest.clearAllMocks();
    lastVoiceSessionInstance = null;
    lastTransportInstance = null;
    lastSinkInstance = null;

    mockTwilioWs = new EventEmitter();
    mockSocket = {
      destroy: jest.fn(),
      write: jest.fn(),
    };
    mockHead = Buffer.alloc(0);

    mockWss = {
      handleUpgrade: jest.fn((req, socket, head, cb) => {
        cb(mockTwilioWs);
      }),
    };

    mockExternalUserService.resolveOrCreate.mockResolvedValue({ _id: 'ext_user_123' });
    mockProjectCredentialRepository.findByProject.mockResolvedValue([
      { _id: 'cred_active_1', status: 'ACTIVE' },
    ]);
    mockVoiceService.resolveVoiceProvider.mockResolvedValue({ apiKey: 'gemini_test_key' });
    mockVoiceService.buildVoiceLiveConfig.mockResolvedValue({
      model: 'gemini-3.1-flash-live-preview',
      voiceName: 'Aoede',
      liveConfig: { systemInstruction: 'Telephony prompt' },
      toolsByName: new Map(),
    });
    mockVoiceThreadService.buildSeedSuffix.mockResolvedValue({
      excerpt: '\n\nPrior call summary...',
    });
  });

  test('attachTwilioGateway registers upgrade listener on HTTP server', () => {
    const server = new EventEmitter();
    const wss = attachTwilioGateway(server);
    expect(wss).toBeDefined();

    // Verify non-matching path does not trigger upgrade
    const nonMatchingReq = { url: '/other-path' };
    server.emit('upgrade', nonMatchingReq, mockSocket, mockHead);
    expect(mockSocket.destroy).not.toHaveBeenCalled();
    expect(mockWss.handleUpgrade).not.toHaveBeenCalled();
  });

  test('rejects an upgrade with no ticket — query params are never trusted', async () => {
    const req = { url: `${TWILIO_WS_PATH}?projectId=proj_test&agentId=agent_123` };
    const url = new URL(req.url, 'http://localhost');

    await expect(handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss)).rejects.toThrow(
      /Missing ticket/
    );
    expect(mockWss.handleUpgrade).not.toHaveBeenCalled();
  });

  test('rejects a browser ticket on the telephony path', async () => {
    const browserTicket = mintVoiceTicket({
      principalType: 'ProjectRuntime',
      audience: 'browser',
      domain: 'proj_test',
      agentId: 'agent_123',
      subjectId: 'user_1',
      credentialId: 'cred_active_1',
      threadId: 'agui-proj_test-agent_123-user_1',
    }).ticket;
    const url = new URL(upgradeUrl(browserTicket), 'http://localhost');

    await expect(
      handleTwilioUpgrade({ url: url.pathname + url.search }, mockSocket, mockHead, url, mockWss)
    ).rejects.toThrow(/not valid for telephony/);
    expect(mockWss.handleUpgrade).not.toHaveBeenCalled();
  });

  test('handleTwilioUpgrade initiates a voice session from ticket claims', async () => {
    const mockAgent = {
      _id: 'agent_123',
      name: 'Support Agent',
      populate: jest.fn().mockResolvedValue(true),
    };
    mockAgentRepository.findById.mockResolvedValue(mockAgent);

    const req = { url: upgradeUrl(mintTicket()) };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);
    expect(mockWss.handleUpgrade).toHaveBeenCalled();
    expect(lastTransportInstance).toBeDefined();

    lastTransportInstance.emit('stream_started', {
      streamSid: 'MZ_STREAM_1',
      callSid: 'CA_CALL_1',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(mockAgentRepository.findById).toHaveBeenCalledWith('agent_123');
    expect(mockAgent.populate).toHaveBeenCalledWith([
      'skills',
      'mcps',
      'knowledgeBases',
      'storeMounts',
      'restApiTools',
      'restApiToolSources',
      'rcpSources',
    ]);
    // Identity is the asserted external user id, never the phone number.
    expect(mockExternalUserService.resolveOrCreate).toHaveBeenCalledWith(
      'proj_test',
      '+15551234567'
    );
    expect(mockVoiceSessionConstructor).toHaveBeenCalled();

    const params = lastVoiceSessionInstance.params;
    expect(params.claims.subjectId).toBe('+15551234567');
    expect(params.claims.threadId).toBe('agui-proj_test-agent_123-+15551234567');
    expect(params.initialContext.callerPhone).toBe('+15551234567');
    expect(params.initialContext.callSid).toBe('CA_CALL_1');
    expect(lastVoiceSessionInstance.start).toHaveBeenCalled();

    // Verify thread seeding appended to systemInstruction
    expect(params.liveConfig.systemInstruction).toContain('Prior call summary...');

    // Verify on close flushes transcript sink
    lastTransportInstance.emit('close');
    expect(lastSinkInstance.flush).toHaveBeenCalled();
  });

  test('uses an explicitly asserted user id as the conversation identity', async () => {
    mockAgentRepository.findById.mockResolvedValue({
      _id: 'agent_123',
      populate: jest.fn().mockResolvedValue(true),
    });

    const req = {
      url: upgradeUrl(
        mintTicket({
          subjectId: 'user_2ab',
          threadId: 'agui-proj_test-agent_123-user_2ab',
          telephony: { channel: 'voice', from: '+15559990000', callSid: null },
        })
      ),
    };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);
    lastTransportInstance.emit('stream_started', { streamSid: 'MZ_1', callSid: 'CA_9' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockExternalUserService.resolveOrCreate).toHaveBeenCalledWith('proj_test', 'user_2ab');
    expect(lastVoiceSessionInstance.params.claims.subjectId).toBe('user_2ab');
    expect(lastVoiceSessionInstance.params.initialContext.callerPhone).toBe('+15559990000');
  });

  test('a ticket is single-use — a replay is rejected', async () => {
    mockAgentRepository.findById.mockResolvedValue({
      _id: 'agent_123',
      populate: jest.fn().mockResolvedValue(true),
    });
    const ticket = mintTicket();
    const url = new URL(upgradeUrl(ticket), 'http://localhost');
    const req = { url: upgradeUrl(ticket) };

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);

    const replayUrl = new URL(upgradeUrl(ticket), 'http://localhost');
    await expect(
      handleTwilioUpgrade(
        { url: upgradeUrl(ticket) },
        mockSocket,
        mockHead,
        replayUrl,
        mockWss
      )
    ).rejects.toThrow(/already used/);
  });

  test('closes transport with 1011 if agentId is ARCHITECT_AGENT_ID', async () => {
    const req = { url: upgradeUrl(mintTicket({ agentId: ARCHITECT_AGENT_ID })) };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);

    lastTransportInstance.emit('stream_started', {
      streamSid: 'MZ_ARCHITECT',
      callSid: 'CA_ARCHITECT',
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(lastTransportInstance.close).toHaveBeenCalledWith(
      1011,
      'Failed to start AI voice session'
    );
  });

  test('closes transport with 1011 if agent cannot be found in repository', async () => {
    mockAgentRepository.findById.mockResolvedValue(null);

    const req = { url: upgradeUrl(mintTicket({ agentId: 'agent_not_found' })) };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);

    lastTransportInstance.emit('stream_started', {
      streamSid: 'MZ_NOT_FOUND',
      callSid: 'CA_NOT_FOUND',
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(lastTransportInstance.close).toHaveBeenCalledWith(
      1011,
      'Failed to start AI voice session'
    );
  });

  test('continues ephemerally if thread seeding or sink setup fails', async () => {
    const mockAgent = {
      _id: 'agent_resilient',
      name: 'Resilient Agent',
    };
    mockAgentRepository.findById.mockResolvedValue(mockAgent);
    mockVoiceThreadService.buildSeedSuffix.mockRejectedValue(new Error('MongoDB timeout'));

    const req = { url: upgradeUrl(mintTicket({ agentId: 'agent_resilient' })) };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);

    lastTransportInstance.emit('stream_started', {
      streamSid: 'MZ_FAILOVER',
      callSid: 'CA_FAILOVER',
    });

    await new Promise((resolve) => setImmediate(resolve));

    // Session should still start even though thread seeding threw error
    expect(lastVoiceSessionInstance).toBeDefined();
    expect(lastVoiceSessionInstance.start).toHaveBeenCalled();
  });
});
