import { jest } from '@jest/globals';

const repo = {
  newId: jest.fn(() => 'bbbbbbbbbbbbbbbbbbbbbbbb'),
  isValidId: jest.fn(() => true),
  create: jest.fn(async () => ({})),
  update: jest.fn(async () => ({})),
  insertSpans: jest.fn(async () => {}),
  findAudioMeta: jest.fn(),
  exists: jest.fn(async () => true),
  findStaleVoiceRunning: jest.fn(async () => []),
  search: jest.fn(),
  count: jest.fn(),
  aggregateTraces: jest.fn(),
  aggregateSpans: jest.fn(),
};
const store = {
  stat: jest.fn(),
  createReadStream: jest.fn(),
  removeTemp: jest.fn(async () => {}),
  sweep: jest.fn(async () => ({ deleted: 2 })),
  tempPaths: (id) => ({ user: `${id}.user.pcm`, agent: `${id}.agent.pcm` }),
};

jest.unstable_mockModule('../src/modules/traces/trace.repository.js', () => ({ default: repo }));
jest.unstable_mockModule('../src/modules/traces/traceAudioStore.js', () => ({
  default: store,
  TraceAudioStore: class {},
}));

const config = (await import('../src/config/index.js')).default;
const mod = await import('../src/modules/traces/trace.service.js');
const traceService = mod.default;
const { maskPhone } = mod;

const claims = {
  principalType: 'ProjectRuntime',
  domain: 'proj1',
  agentId: 'agent1',
  subjectId: 'ext-1',
  threadId: 'thread-1',
};

describe('maskPhone', () => {
  test.each([
    ['+919876544321', '+91•••••4321'],
    ['+14155550123', '+1•••••0123'],
    ['9876544321', '•••••4321'],
    ['123', '••••'],
    [null, null],
    ['', null],
  ])('%s → %s', (input, out) => expect(maskPhone(input)).toBe(out));
});

describe('traceService voice', () => {
  const saved = { ...config.traces, voiceAudio: { ...config.traces.voiceAudio } };
  beforeEach(() => {
    jest.clearAllMocks();
    config.traces.enabled = true;
    config.traces.voiceAudio.enabled = false;
  });
  afterAll(() => Object.assign(config.traces, saved));

  test('beginVoice returns null when tracing is off or for Persona calls', () => {
    config.traces.enabled = false;
    expect(traceService.beginVoice({ claims })).toBeNull();
    config.traces.enabled = true;
    expect(traceService.beginVoice({ claims: { ...claims, domain: 'persona' } })).toBeNull();
    expect(traceService.beginVoice({})).toBeNull();
  });

  test('beginVoice builds a voice trace for an API call with a masked caller number', async () => {
    const tracer = traceService.beginVoice({
      claims,
      agentName: 'Tutor',
      model: 'gemini-live',
      provider: 'My Gemini',
      voiceName: 'Puck',
      telephony: { callSid: 'CA1', from: '+919876544321', channel: 'voice' },
    });
    expect(tracer.recording).toBe(false);
    tracer.start();
    await tracer.chain;
    const doc = repo.create.mock.calls[0][0];
    expect(doc).toMatchObject({
      _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      domain: 'proj1',
      agentId: 'agent1',
      agentName: 'Tutor',
      threadId: 'thread-1',
      source: 'api',
      channel: 'voice',
      endUserId: 'ext-1',
      model: 'gemini-live',
      provider: 'My Gemini',
      status: 'running',
    });
    expect(doc.metadata.voice).toEqual({
      voiceName: 'Puck',
      telephony: { callSid: 'CA1', callerPhone: '+91•••••4321', channel: 'voice' },
    });
    expect(JSON.stringify(doc)).not.toContain('9876544321');
    await tracer.end({ reason: 'client_closed' });
  });

  test('Studio calls are traced as playground; recording follows TRACE_VOICE_AUDIO', () => {
    config.traces.voiceAudio.enabled = true;
    const tracer = traceService.beginVoice({
      claims: { ...claims, principalType: 'ProjectAdmin' },
    });
    expect(tracer.base.source).toBe('playground');
    expect(tracer.recording).toBe(true);
  });

  test('getAudio: 404 for another project or no recording, 409 while processing', async () => {
    repo.findAudioMeta.mockResolvedValueOnce(null);
    await expect(traceService.getAudio('proj1', 'x')).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findAudioMeta).toHaveBeenCalledWith({ _id: 'x', domain: 'proj1' });

    repo.findAudioMeta.mockResolvedValueOnce({ audio: null });
    await expect(traceService.getAudio('proj1', 'x')).rejects.toMatchObject({ statusCode: 404 });

    repo.findAudioMeta.mockResolvedValueOnce({ audio: { status: 'processing' } });
    await expect(traceService.getAudio('proj1', 'x')).rejects.toMatchObject({
      statusCode: 409,
      code: 'AUDIO_NOT_READY',
    });

    repo.findAudioMeta.mockResolvedValueOnce({ audio: { status: 'ready', storageKey: 'k.wav' } });
    store.stat.mockResolvedValueOnce(null);
    await expect(traceService.getAudio('proj1', 'x')).rejects.toMatchObject({ statusCode: 404 });

    repo.findAudioMeta.mockResolvedValueOnce({
      audio: { status: 'ready', storageKey: 'k.wav', mimeType: 'audio/wav' },
    });
    store.stat.mockResolvedValueOnce({ size: 1234 });
    await expect(traceService.getAudio('proj1', 'x')).resolves.toEqual({
      key: 'k.wav',
      size: 1234,
      mimeType: 'audio/wav',
    });
  });

  test('sweepVoice cancels stale running calls and sweeps files', async () => {
    repo.findStaleVoiceRunning.mockResolvedValueOnce([
      { _id: 'cccccccccccccccccccccccc', audio: { status: 'recording' } },
    ]);
    const result = await traceService.sweepVoice();
    expect(result).toEqual({ staleTraces: 1, deletedFiles: 2 });
    expect(repo.update).toHaveBeenCalledWith(
      'cccccccccccccccccccccccc',
      expect.objectContaining({
        status: 'cancelled',
        audio: expect.objectContaining({ status: 'failed' }),
      })
    );
    expect(store.removeTemp).toHaveBeenCalledWith('cccccccccccccccccccccccc');
    const sweepArgs = store.sweep.mock.calls[0][0];
    expect(sweepArgs.olderThanMs).toBe(config.traces.retentionDays * 86400000);
    await expect(sweepArgs.isKnown('x')).resolves.toBe(true);
  });

  test('list() filters by channel', async () => {
    repo.search.mockResolvedValue([]);
    repo.count.mockResolvedValue(0);
    await traceService.list('proj1', { channel: 'voice' });
    expect(repo.search.mock.calls[0][0]).toMatchObject({ domain: 'proj1', channel: 'voice' });
  });
});
