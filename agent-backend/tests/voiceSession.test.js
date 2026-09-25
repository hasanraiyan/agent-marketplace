import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

let lastSessionCallbacks = null;
const sentRealtimeInputs = [];
const sentToolResponses = [];

const mockGeminiSession = {
  sendRealtimeInput: jest.fn((input) => sentRealtimeInputs.push(input)),
  sendToolResponse: jest.fn((res) => sentToolResponses.push(res)),
  close: jest.fn(),
};

jest.unstable_mockModule('../src/modules/voice/gateway/geminiLiveClient.js', () => ({
  connectGeminiLive: jest.fn(async ({ callbacks }) => {
    lastSessionCallbacks = callbacks;
    if (callbacks.onopen) callbacks.onopen();
    return mockGeminiSession;
  }),
  default: {
    connectGeminiLive: jest.fn(async ({ callbacks }) => {
      lastSessionCallbacks = callbacks;
      if (callbacks.onopen) callbacks.onopen();
      return mockGeminiSession;
    }),
  },
}));

const { VoiceSession } = await import('../src/modules/voice/gateway/VoiceSession.js');

class MockClientWebSocket extends EventEmitter {
  constructor() {
    super();
    this.OPEN = 1;
    this.readyState = 1;
    this.sent = [];
    this.pingCount = 0;
  }

  send(data) {
    this.sent.push(data);
  }

  ping() {
    this.pingCount++;
  }

  close(code = 1000, reason = '') {
    this.readyState = 3;
    this.closeCode = code;
    this.closeReason = reason;
    this.emit('close', code, reason);
  }
}

describe('VoiceSession Unit Tests', () => {
  let clientWs;
  let claims;
  let session;
  const committedTranscripts = [];

  beforeEach(() => {
    jest.clearAllMocks();
    sentRealtimeInputs.length = 0;
    sentToolResponses.length = 0;
    committedTranscripts.length = 0;

    clientWs = new MockClientWebSocket();
    claims = {
      principalType: 'ProjectRuntime',
      domain: 'proj_123',
      agentId: 'agent_456',
      subjectId: 'user_789',
      threadId: 'thread_abc',
    };
  });

  afterEach(() => {
    if (session && !session.closed) {
      session._closeSession('test_teardown');
    }
  });

  test('initializes upstream connection and handles client ping / audio', async () => {
    session = new VoiceSession({
      clientWs,
      claims,
      apiKey: 'test-key',
      model: 'gemini-3.1-flash-live-preview',
      voiceName: 'Puck',
      liveConfig: { systemInstruction: 'You are an assistant.' },
      toolsByName: new Map(),
      onTranscriptCommit: (role, text) => committedTranscripts.push({ role, text }),
      initialContext: { callerPhone: '+123456789' },
    });

    await session.start();
    expect(lastSessionCallbacks).toBeDefined();

    // 1. Simulate setupComplete from Gemini
    lastSessionCallbacks.onmessage({
      setupComplete: true,
    });

    const readyMsg = clientWs.sent.find((s) => {
      try {
        const parsed = JSON.parse(s);
        return parsed.name === 'voice_session_ready';
      } catch {
        return false;
      }
    });
    expect(readyMsg).toBeDefined();

    // 2. Client sends ping control frame
    clientWs.emit('message', JSON.stringify({ type: 'ping' }), false);
    const pongMsg = clientWs.sent.find((s) => {
      try {
        return JSON.parse(s).type === 'pong';
      } catch {
        return false;
      }
    });
    expect(pongMsg).toBeDefined();

    // 3. Client sends binary audio frame
    const audioPayload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    clientWs.emit('message', audioPayload, true);
    expect(mockGeminiSession.sendRealtimeInput).toHaveBeenCalledWith({
      audio: {
        data: audioPayload.toString('base64'),
        mimeType: 'audio/pcm;rate=16000',
      },
    });
  });

  test('executes tool call with turnContext and sanitizes output', async () => {
    const mockTool = {
      invoke: jest.fn(async (args, config) => {
        expect(config?.configurable?.turnContext?.callerPhone).toBe('+123456789');
        return { bookingId: 'BK-999', status: 'confirmed' };
      }),
    };

    const toolsByName = new Map([['book_flight', mockTool]]);

    session = new VoiceSession({
      clientWs,
      claims,
      apiKey: 'test-key',
      model: 'gemini-3.1-flash-live-preview',
      voiceName: 'Puck',
      liveConfig: { systemInstruction: 'Test' },
      toolsByName,
      initialContext: { callerPhone: '+123456789' },
    });

    await session.start();

    // Gemini invokes tool
    await lastSessionCallbacks.onmessage({
      toolCall: {
        functionCalls: [
          {
            id: 'call_1',
            name: 'book_flight',
            args: { destination: 'SFO' },
          },
        ],
      },
    });

    expect(mockTool.invoke).toHaveBeenCalled();
    expect(mockGeminiSession.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [
        {
          id: 'call_1',
          name: 'book_flight',
          response: {
            output: { bookingId: 'BK-999', status: 'confirmed' },
          },
        },
      ],
    });
  });

  test('updates turnContext dynamically on voice.context message', async () => {
    const mockTool = {
      invoke: jest.fn(async (args, config) => {
        return { userVip: config?.configurable?.turnContext?.vipStatus };
      }),
    };

    const toolsByName = new Map([['check_vip', mockTool]]);

    session = new VoiceSession({
      clientWs,
      claims,
      apiKey: 'test-key',
      model: 'gemini-3.1-flash-live-preview',
      voiceName: 'Puck',
      liveConfig: { systemInstruction: 'Test' },
      toolsByName,
      initialContext: { callerPhone: '+123456789' },
    });

    await session.start();

    // Client dynamically updates context mid-call
    clientWs.emit(
      'message',
      JSON.stringify({
        type: 'voice.context',
        context: { vipStatus: 'GOLD_TIER' },
      }),
      false
    );

    expect(session.turnContext.vipStatus).toBe('GOLD_TIER');
    expect(session.turnContext.callerPhone).toBe('+123456789');

    // Gemini triggers tool, which receives updated turnContext
    await lastSessionCallbacks.onmessage({
      toolCall: {
        functionCalls: [
          {
            id: 'call_2',
            name: 'check_vip',
            args: {},
          },
        ],
      },
    });

    expect(mockGeminiSession.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [
        {
          id: 'call_2',
          name: 'check_vip',
          response: {
            output: { userVip: 'GOLD_TIER' },
          },
        },
      ],
    });
  });

  test('handles barge-in interruption by advancing turnSeq and emitting voice_interrupted', async () => {
    session = new VoiceSession({
      clientWs,
      claims,
      apiKey: 'test-key',
      model: 'gemini-3.1-flash-live-preview',
      voiceName: 'Puck',
      liveConfig: { systemInstruction: 'Test' },
      toolsByName: new Map(),
      onTranscriptCommit: (role, text) => committedTranscripts.push({ role, text }),
    });

    await session.start();
    const initialTurnSeq = session.turnSeq;

    // Simulate model outputting audio
    lastSessionCallbacks.onmessage({
      serverContent: {
        modelTurn: {
          parts: [{ inlineData: { data: Buffer.from([0x01, 0x02]).toString('base64') } }],
        },
      },
    });

    // Simulate barge-in interruption signal from Gemini
    lastSessionCallbacks.onmessage({
      serverContent: {
        interrupted: true,
      },
    });

    expect(session.turnSeq).toBeGreaterThan(initialTurnSeq);

    const interruptMsg = clientWs.sent.find((s) => {
      try {
        const parsed = JSON.parse(s);
        return parsed.name === 'voice_interrupted';
      } catch {
        return false;
      }
    });
    expect(interruptMsg).toBeDefined();
    const parsed = JSON.parse(interruptMsg);
    expect(parsed.value.turnSeq).toBe(session.turnSeq);
  });

  test('handles end_call tool and closes session gracefully after turnComplete', async () => {
    session = new VoiceSession({
      clientWs,
      claims,
      apiKey: 'test-key',
      model: 'gemini-3.1-flash-live-preview',
      voiceName: 'Puck',
      liveConfig: { systemInstruction: 'Test' },
      toolsByName: new Map(),
    });

    await session.start();

    // Model invokes synthetic end_call tool
    await lastSessionCallbacks.onmessage({
      toolCall: {
        functionCalls: [
          {
            id: 'call_end',
            name: 'end_call',
            args: {},
          },
        ],
      },
    });

    expect(session.endCallRequested).toBe(true);
    expect(session.closed).toBe(false);

    // Turn finishes
    lastSessionCallbacks.onmessage({
      serverContent: {
        turnComplete: true,
      },
    });

    expect(session.closed).toBe(true);
  });
});
