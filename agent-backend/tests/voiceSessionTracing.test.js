import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

let lastCallbacks = null;
const mockGeminiSession = {
  sendRealtimeInput: jest.fn(),
  sendToolResponse: jest.fn(),
  close: jest.fn(),
};

jest.unstable_mockModule('../src/modules/voice/gateway/geminiLiveClient.js', () => {
  const connectGeminiLive = jest.fn(async ({ callbacks }) => {
    lastCallbacks = callbacks;
    return mockGeminiSession;
  });
  return { connectGeminiLive, default: { connectGeminiLive } };
});

const { VoiceSession } = await import('../src/modules/voice/gateway/VoiceSession.js');

class MockWs extends EventEmitter {
  constructor() {
    super();
    this.OPEN = 1;
    this.readyState = 1;
    this.sent = [];
  }
  send(d) {
    this.sent.push(d);
  }
  ping() {}
  close() {
    this.readyState = 3;
    this.emit('close');
  }
}

/** Records every tracer call as [method, ...args]. */
function recordingTracer({ recording = false } = {}) {
  const calls = [];
  const handler = {
    get(target, prop) {
      if (prop === 'traceId') return 'trace-1';
      if (prop === 'recording') return recording;
      if (prop === 'calls') return calls;
      if (prop === 'then') return undefined;
      return (...args) => {
        calls.push([prop, ...args]);
        if (prop === 'toolCallbacks') return [];
        return undefined;
      };
    },
  };
  return new Proxy({}, handler);
}

function throwingTracer() {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return undefined;
        if (prop === 'traceId' || prop === 'recording') throw new Error('tracer broken');
        return () => {
          throw new Error('tracer broken');
        };
      },
    }
  );
}

const customs = (ws, name) =>
  ws.sent
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    })
    .filter((e) => e?.type === 'CUSTOM' && e.name === name);

const methods = (tracer) => tracer.calls.map((c) => c[0]);

async function scriptedCall(session, ws) {
  await session.start();
  const send = (m) => lastCallbacks.onmessage(m);
  await send({ setupComplete: true });
  await send({ voiceActivity: { voiceActivityType: 'ACTIVITY_START' } });
  ws.emit('message', Buffer.alloc(320), true);
  await send({ voiceActivity: { voiceActivityType: 'ACTIVITY_END' } });
  await send({ serverContent: { inputTranscription: { text: 'what time is it?' } } });
  await send({ toolCall: { functionCalls: [{ id: 'c1', name: 'get_time', args: {} }] } });
  await send({
    serverContent: {
      modelTurn: { parts: [{ inlineData: { data: Buffer.alloc(480).toString('base64') } }] },
      outputTranscription: { text: 'It is noon.' },
    },
  });
  await send({
    usageMetadata: { promptTokenCount: 100, responseTokenCount: 20, totalTokenCount: 120 },
    serverContent: { turnComplete: true },
  });
  await send({
    usageMetadata: { promptTokenCount: 140, responseTokenCount: 10, totalTokenCount: 150 },
  });
}

describe('VoiceSession tracing', () => {
  let ws;
  let session;
  const claims = {
    principalType: 'ProjectAdmin',
    domain: 'proj1',
    agentId: 'agent1',
    subjectId: 'admin1',
    threadId: null,
  };
  const tool = { invoke: jest.fn(async () => ({ time: '12:00' })) };

  beforeEach(() => {
    jest.clearAllMocks();
    ws = new MockWs();
  });
  afterEach(() => {
    if (session && !session.closed) session._closeSession('test_teardown');
  });

  test('reports turns, speech, transcripts, tools, audio and usage to the tracer', async () => {
    const tracer = recordingTracer({ recording: true });
    session = new VoiceSession({
      clientWs: ws,
      claims,
      apiKey: 'k',
      model: 'gemini-live',
      liveConfig: {},
      toolsByName: new Map([['get_time', tool]]),
      tracer,
    });
    await scriptedCall(session, ws);
    session._closeSession('agent_ended');
    await new Promise((r) => setImmediate(r));

    const m = methods(tracer);
    for (const name of [
      'start',
      'turnStart',
      'userSpeechStart',
      'userAudio',
      'userSpeechEnd',
      'userSaid',
      'toolStart',
      'toolCallbacks',
      'toolEnd',
      'agentAudio',
      'agentSaid',
      'usage',
      'turnEnd',
      'end',
    ]) {
      expect(m).toContain(name);
    }
    // usage is reported before the turnComplete it arrived with
    expect(m.indexOf('usage')).toBeLessThan(m.indexOf('turnEnd'));
    expect(tracer.calls.find((c) => c[0] === 'userSaid')[1]).toBe('what time is it?');
    expect(tracer.calls.find((c) => c[0] === 'toolEnd')[2]).toMatchObject({
      output: { time: '12:00' },
    });
    expect(tracer.calls.find((c) => c[0] === 'end')[1]).toEqual({ reason: 'agent_ended' });

    // Studio (ProjectAdmin) client is told the trace id; recording notice sent.
    expect(customs(ws, 'trace_started')[0].value).toEqual({ traceId: 'trace-1' });
    expect(customs(ws, 'voice_recording')[0].value).toEqual({ enabled: true });
  });

  test('voice_session_ended reports usage summed over the call, not the last message', async () => {
    session = new VoiceSession({
      clientWs: ws,
      claims,
      apiKey: 'k',
      model: 'gemini-live',
      liveConfig: {},
      toolsByName: new Map([['get_time', tool]]),
    });
    await scriptedCall(session, ws);
    session._closeSession('client_closed');
    const [ended] = customs(ws, 'voice_session_ended');
    expect(ended.value.usage).toMatchObject({
      inputTokens: 240,
      outputTokens: 30,
      totalTokens: 270,
    });
  });

  test('trace_started is not sent to API (ProjectRuntime) clients', async () => {
    const tracer = recordingTracer();
    session = new VoiceSession({
      clientWs: ws,
      claims: { ...claims, principalType: 'ProjectRuntime' },
      apiKey: 'k',
      model: 'gemini-live',
      liveConfig: {},
      tracer,
    });
    await session.start();
    await lastCallbacks.onmessage({ setupComplete: true });
    expect(customs(ws, 'trace_started')).toHaveLength(0);
    expect(customs(ws, 'voice_recording')).toHaveLength(0);
  });

  test('a reconnect is reported, and the same tracer keeps going', async () => {
    const tracer = recordingTracer();
    session = new VoiceSession({
      clientWs: ws,
      claims,
      apiKey: 'k',
      model: 'gemini-live',
      liveConfig: {},
      tracer,
    });
    await session.start();
    session.resumptionHandle = 'h1';
    await session._reconnectUpstream();
    expect(methods(tracer)).toContain('reconnected');
  });

  test('the call keeps working when every tracer method throws', async () => {
    session = new VoiceSession({
      clientWs: ws,
      claims,
      apiKey: 'k',
      model: 'gemini-live',
      liveConfig: {},
      toolsByName: new Map([['get_time', tool]]),
      tracer: throwingTracer(),
    });
    await expect(scriptedCall(session, ws)).resolves.toBeUndefined();
    // Audio still forwarded to Gemini, tool still answered, captions still sent.
    expect(mockGeminiSession.sendRealtimeInput).toHaveBeenCalled();
    expect(mockGeminiSession.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [{ id: 'c1', name: 'get_time', response: { output: { time: '12:00' } } }],
    });
    expect(customs(ws, 'voice_transcript').length).toBeGreaterThan(0);
    expect(() => session._closeSession('agent_ended')).not.toThrow();
    expect(customs(ws, 'voice_session_ended')).toHaveLength(1);
  });
});
