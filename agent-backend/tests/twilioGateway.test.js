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

const { attachTwilioGateway, handleTwilioUpgrade, TWILIO_WS_PATH } = await import(
  '../src/modules/twilio/twilioGateway.js'
);

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

  test('handleTwilioUpgrade initiates voice session when stream starts with valid parameters', async () => {
    const mockAgent = {
      _id: 'agent_123',
      name: 'Support Agent',
      populate: jest.fn().mockResolvedValue(true),
    };
    mockAgentRepository.findById.mockResolvedValue(mockAgent);

    const req = { url: `${TWILIO_WS_PATH}?projectId=proj_test&agentId=agent_123` };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);
    expect(mockWss.handleUpgrade).toHaveBeenCalled();
    expect(lastTransportInstance).toBeDefined();

    // Emit stream_started on transport
    lastTransportInstance.emit('stream_started', {
      streamSid: 'MZ_STREAM_1',
      callSid: 'CA_CALL_1',
      customParameters: {
        agentId: 'agent_123',
        projectId: 'proj_test',
        callerPhone: '+15551234567',
      },
    });

    // Wait microtasks for async startVoiceSessionForTwilio
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
    expect(mockExternalUserService.resolveOrCreate).toHaveBeenCalledWith('proj_test', '+15551234567');
    expect(mockVoiceSessionConstructor).toHaveBeenCalled();
    expect(lastVoiceSessionInstance.start).toHaveBeenCalled();

    // Verify thread seeding appended to systemInstruction
    const passedLiveConfig = lastVoiceSessionInstance.params.liveConfig;
    expect(passedLiveConfig.systemInstruction).toContain('Prior call summary...');

    // Verify on close flushes transcript sink
    lastTransportInstance.emit('close');
    expect(lastSinkInstance.flush).toHaveBeenCalled();
  });

  test('closes transport with 1008 if agentId or projectId is missing', async () => {
    const req = { url: TWILIO_WS_PATH };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);

    // Stream started without agentId / projectId
    lastTransportInstance.emit('stream_started', {
      streamSid: 'MZ_STREAM_MISSING',
      callSid: 'CA_CALL_MISSING',
      customParameters: {},
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(lastTransportInstance.close).toHaveBeenCalledWith(
      1008,
      'Missing agent or project configuration'
    );
  });

  test('closes transport with 1011 if agentId is ARCHITECT_AGENT_ID', async () => {
    const req = { url: `${TWILIO_WS_PATH}?projectId=proj_test&agentId=${ARCHITECT_AGENT_ID}` };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);

    lastTransportInstance.emit('stream_started', {
      streamSid: 'MZ_ARCHITECT',
      callSid: 'CA_ARCHITECT',
      customParameters: {
        agentId: ARCHITECT_AGENT_ID,
        projectId: 'proj_test',
      },
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(lastTransportInstance.close).toHaveBeenCalledWith(
      1011,
      'Failed to start AI voice session'
    );
  });

  test('closes transport with 1011 if agent cannot be found in repository', async () => {
    mockAgentRepository.findById.mockResolvedValue(null);

    const req = { url: `${TWILIO_WS_PATH}?projectId=proj_test&agentId=agent_not_found` };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);

    lastTransportInstance.emit('stream_started', {
      streamSid: 'MZ_NOT_FOUND',
      callSid: 'CA_NOT_FOUND',
      customParameters: {
        agentId: 'agent_not_found',
        projectId: 'proj_test',
      },
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

    const req = { url: `${TWILIO_WS_PATH}?projectId=proj_test&agentId=agent_resilient` };
    const url = new URL(req.url, 'http://localhost');

    await handleTwilioUpgrade(req, mockSocket, mockHead, url, mockWss);

    lastTransportInstance.emit('stream_started', {
      streamSid: 'MZ_FAILOVER',
      callSid: 'CA_FAILOVER',
      customParameters: {
        agentId: 'agent_resilient',
        projectId: 'proj_test',
        callerPhone: '+19998887777',
      },
    });

    await new Promise((resolve) => setImmediate(resolve));

    // Session should still start even though thread seeding threw error
    expect(lastVoiceSessionInstance).toBeDefined();
    expect(lastVoiceSessionInstance.start).toHaveBeenCalled();
  });
});
