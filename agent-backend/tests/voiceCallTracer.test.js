import fs from 'fs';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';
import { VoiceCallTracer, statusForCloseReason } from '../src/modules/traces/VoiceCallTracer.js';
import { TraceAudioStore } from '../src/modules/traces/traceAudioStore.js';

const TRACE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function fakeRepo() {
  const repo = {
    created: null,
    updates: [],
    spans: [],
    create: jest.fn(async (doc) => {
      repo.created = doc;
    }),
    update: jest.fn(async (_id, fields) => {
      repo.updates.push(fields);
    }),
    insertSpans: jest.fn(async (rows) => {
      repo.spans.push(...rows);
    }),
  };
  return repo;
}

const base = {
  domain: 'proj1',
  agentId: 'agent1',
  agentName: 'Tutor',
  source: 'api',
  channel: 'voice',
  model: 'gemini-live',
  provider: 'Gemini',
};

const pcm = (samples) => Buffer.alloc(samples * 2, 1);
const lastUpdate = (repo) => Object.assign({}, ...repo.updates);

describe('statusForCloseReason', () => {
  test.each([
    ['agent_ended', 'success'],
    ['client_closed', 'success'],
    ['upstream_error', 'error'],
    ['idle', 'cancelled'],
    ['max_duration', 'cancelled'],
    ['something_else', 'success'],
  ])('%s → %s', (reason, status) => expect(statusForCloseReason(reason)).toBe(status));
});

describe('VoiceCallTracer', () => {
  let dir;
  let t;
  beforeEach(() => {
    t = 1_000_000;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-tracer-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('creates a running trace, writes steps + totals at the end', async () => {
    const repo = fakeRepo();
    const tracer = new VoiceCallTracer({
      traceId: TRACE_ID,
      base,
      repository: repo,
      now: () => t,
      usageMode: 'per_response',
      metadata: { voiceName: 'Puck' },
    });
    tracer.start();
    tracer.turnStart('run-1');
    tracer.userSaid('hello');
    tracer.agentAudio(pcm(10));
    tracer.usage({ promptTokenCount: 50, responseTokenCount: 10, totalTokenCount: 60 });
    tracer.agentSaid('hi there');
    tracer.turnEnd();
    t += 3000;
    await tracer.end({ reason: 'agent_ended' });

    expect(repo.created).toMatchObject({
      _id: TRACE_ID,
      status: 'running',
      channel: 'voice',
      audio: null,
      metadata: { voice: { voiceName: 'Puck' } },
    });
    expect(repo.spans.map((s) => s.kind).sort()).toEqual(['chain', 'human', 'llm']);
    expect(repo.spans.every((s) => s.traceId === TRACE_ID && s.domain === 'proj1')).toBe(true);
    const final = lastUpdate(repo);
    expect(final).toMatchObject({
      status: 'success',
      input: 'hello',
      output: 'hi there',
      durationMs: 3000,
      llmCalls: 1,
    });
    expect(final.usage.totalTokens).toBe(60);
    expect(final.metadata.voice).toMatchObject({
      voiceName: 'Puck',
      endReason: 'agent_ended',
      turns: 1,
    });
    expect(tracer.sessionEndedUsage().totalTokens).toBe(60);
  });

  test('upstream_error ends as an error trace', async () => {
    const repo = fakeRepo();
    const tracer = new VoiceCallTracer({ traceId: TRACE_ID, base, repository: repo });
    tracer.start();
    await tracer.end({ reason: 'upstream_error' });
    expect(lastUpdate(repo)).toMatchObject({ status: 'error', error: 'upstream_error' });
  });

  test('flushes every few turns while the call runs', async () => {
    const repo = fakeRepo();
    const tracer = new VoiceCallTracer({ traceId: TRACE_ID, base, repository: repo, now: () => t });
    tracer.start();
    for (let i = 0; i < 3; i += 1) {
      tracer.turnStart(`run-${i}`);
      tracer.userSaid(`q${i}`);
      tracer.turnEnd();
      t += 5000;
    }
    await tracer.chain;
    expect(repo.spans.length).toBeGreaterThan(0);
    expect(repo.updates.length).toBeGreaterThan(0);
    await tracer.end({ reason: 'client_closed' });
  });

  test('nothing else is written when creating the trace failed', async () => {
    const repo = fakeRepo();
    repo.create.mockRejectedValueOnce(new Error('db down'));
    const tracer = new VoiceCallTracer({ traceId: TRACE_ID, base, repository: repo });
    tracer.start();
    tracer.userSaid('x', { via: 'text' });
    await tracer.end({ reason: 'client_closed' });
    expect(repo.insertSpans).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  test('end() is idempotent', async () => {
    const repo = fakeRepo();
    const tracer = new VoiceCallTracer({ traceId: TRACE_ID, base, repository: repo });
    tracer.start();
    await tracer.end({ reason: 'client_closed' });
    const n = repo.update.mock.calls.length;
    await tracer.end({ reason: 'client_closed' });
    expect(repo.update.mock.calls.length).toBe(n);
  });

  test('records audio, mixes the WAV after the call and marks it ready', async () => {
    const repo = fakeRepo();
    const store = new TraceAudioStore({ dir });
    const tracer = new VoiceCallTracer({
      traceId: TRACE_ID,
      base,
      repository: repo,
      store,
      now: () => t,
    });
    expect(tracer.recording).toBe(true);
    tracer.start();
    await tracer.chain; // the trace row is created in the background
    expect(repo.created.audio).toEqual({ status: 'recording' });
    t += 1000;
    tracer.userAudio(pcm(16000));
    tracer.turnStart('run-1');
    tracer.agentAudio(pcm(24000));
    t += 1000;
    tracer.agentSaid('ok');
    tracer.turnEnd();
    await tracer.end({ reason: 'agent_ended' });

    const final = lastUpdate(repo);
    expect(final.audio).toMatchObject({
      status: 'ready',
      storageKey: `${TRACE_ID}.wav`,
      mimeType: 'audio/wav',
      sampleRate: 16000,
      channels: { left: 'user', right: 'agent' },
    });
    expect(final.audio.durationMs).toBe(2000);
    expect(fs.existsSync(path.join(dir, `${TRACE_ID}.wav`))).toBe(true);
    // temp tracks removed
    expect(fs.existsSync(path.join(dir, `${TRACE_ID}.user.pcm`))).toBe(false);
    expect(fs.existsSync(path.join(dir, `${TRACE_ID}.agent.pcm`))).toBe(false);
    const agentSpan = repo.spans.find((s) => s.kind === 'llm');
    expect(agentSpan.metadata.audio).toEqual({ startMs: 1000, endMs: 2000 });
  });

  test('a failed mix marks the recording failed but keeps the trace', async () => {
    const repo = fakeRepo();
    const tracer = new VoiceCallTracer({
      traceId: TRACE_ID,
      base,
      repository: repo,
      store: new TraceAudioStore({ dir }),
      mix: async () => {
        throw new Error('boom');
      },
    });
    tracer.start();
    tracer.userAudio(pcm(100));
    await tracer.end({ reason: 'client_closed' });
    const final = lastUpdate(repo);
    expect(final.status).toBe('success');
    expect(final.audio).toEqual({ status: 'failed', error: 'boom' });
  });
});
