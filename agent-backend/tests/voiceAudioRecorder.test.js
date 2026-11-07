import fs from 'fs';
import os from 'os';
import path from 'path';
import { VoiceAudioRecorder } from '../src/modules/traces/VoiceAudioRecorder.js';
import {
  MAX_CONCURRENT_MIXES,
  closeMixWorkers,
  mixInWorker,
  mixQueueState,
  mixToStereoWav,
  wavHeader,
} from '../src/modules/traces/traceAudioMix.js';

function fakeStreams() {
  const data = {};
  return {
    data,
    openStream: (p) => {
      data[p] = [];
      return {
        on: () => {},
        write: (b) => data[p].push(Buffer.from(b)),
        end: (cb) => cb(),
      };
    },
  };
}

const samplesOf = (bufs) => Buffer.concat(bufs).length / 2;
const pcm = (samples, value = 1000) => {
  const b = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) b.writeInt16LE(value, i * 2);
  return b;
};

describe('VoiceAudioRecorder', () => {
  let t;
  let fs1;
  let rec;
  const paths = { user: 'u.pcm', agent: 'a.pcm' };

  beforeEach(() => {
    t = 0;
    fs1 = fakeStreams();
    rec = new VoiceAudioRecorder({ paths, now: () => t, openStream: fs1.openStream });
    rec.start(0);
  });

  test('user track follows real time and pads gaps with silence', () => {
    t = 100;
    rec.user(pcm(1600)); // 100 ms ending at t=100
    t = 1100; // 1 s later, but only 100 ms of audio (mic muted 900 ms)
    rec.user(pcm(1600));
    // 1600 + 14400 silence + 1600 = 17600 samples = 1.1 s at 16 kHz
    expect(samplesOf(fs1.data[paths.user])).toBe(17600);
  });

  test('agent audio arriving in a burst is placed back to back and written as real time passes', () => {
    t = 1000;
    const first = rec.agent(pcm(24000)); // 1 s of audio arriving at once
    const second = rec.agent(pcm(24000));
    expect(first).toEqual({ startMs: 1000, endMs: 2000 });
    expect(second).toEqual({ startMs: 2000, endMs: 3000 });
    expect(samplesOf(fs1.data[paths.agent])).toBe(0); // nothing played yet
    t = 2000;
    rec.user(pcm(160)); // any event commits what real time reached
    // 1 s leading silence + first chunk
    expect(samplesOf(fs1.data[paths.agent])).toBe(48000);
  });

  test('barge-in drops the agent audio the listener never heard', () => {
    t = 0;
    rec.agent(pcm(24000 * 3)); // 3 s scheduled from t=0
    t = 1000; // user interrupts after 1 s
    rec.interrupt();
    expect(samplesOf(fs1.data[paths.agent])).toBe(24000); // only the played second
    expect(rec.droppedAgentMs).toBe(2000);
    // The next utterance starts now, not after the dropped audio.
    t = 1500;
    expect(rec.agent(pcm(2400))).toEqual({ startMs: 1500, endMs: 1600 });
  });

  test('stop() writes what was played, drops the rest, and reports a summary', async () => {
    rec.agent(pcm(24000 * 2));
    t = 500;
    const summary = await rec.stop();
    expect(samplesOf(fs1.data[paths.agent])).toBe(12000);
    expect(summary).toMatchObject({ durationMs: 500, truncated: false, failed: null });
    expect(summary.droppedAgentMs).toBe(1500);
  });

  test('stops recording past maxMinutes and marks it truncated', async () => {
    rec = new VoiceAudioRecorder({
      paths,
      now: () => t,
      openStream: fs1.openStream,
      maxMinutes: 1,
    });
    rec.start(0);
    t = 61_000;
    rec.user(pcm(1600));
    expect(rec.truncated).toBe(true);
    expect(fs1.data[paths.user]).toHaveLength(0);
    expect((await rec.stop()).truncated).toBe(true);
  });

  test('an I/O error stops the recording, never throws', () => {
    rec = new VoiceAudioRecorder({
      paths,
      now: () => t,
      openStream: () => ({
        on: () => {},
        write: () => {
          throw new Error('disk full');
        },
        end: (cb) => cb(),
      }),
    });
    rec.start(0);
    t = 100;
    expect(() => rec.user(pcm(1600))).not.toThrow();
    expect(rec.failed.message).toBe('disk full');
    expect(rec.active).toBe(false);
  });
});

describe('mixToStereoWav', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-audio-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('writes a valid stereo 16 kHz WAV: user left, agent (resampled 24k→16k) right', async () => {
    const userPath = path.join(dir, 'u.pcm');
    const agentPath = path.join(dir, 'a.pcm');
    const outPath = path.join(dir, 'out.wav');
    fs.writeFileSync(userPath, pcm(16000, 100)); // 1 s
    fs.writeFileSync(agentPath, pcm(48000, -200)); // 2 s at 24 kHz
    const result = await mixToStereoWav({ userPath, agentPath, outPath });
    expect(result.durationMs).toBe(2000);
    const wav = fs.readFileSync(outPath);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(22)).toBe(2); // channels
    expect(wav.readUInt32LE(24)).toBe(16000); // rate
    expect(wav.readUInt32LE(40)).toBe(32000 * 4); // 2 s × 16 kHz × 2 ch × 2 B
    expect(wav.length).toBe(44 + 32000 * 4);
    expect(wav.readInt16LE(44)).toBe(100); // first frame: user L
    expect(wav.readInt16LE(46)).toBe(-200); // agent R
    const late = 44 + 20000 * 4; // 1.25 s: user finished, agent still talking
    expect(wav.readInt16LE(late)).toBe(0);
    expect(wav.readInt16LE(late + 2)).toBe(-200);
  });

  test('returns null when nothing was recorded', async () => {
    const result = await mixToStereoWav({
      userPath: path.join(dir, 'missing-u.pcm'),
      agentPath: path.join(dir, 'missing-a.pcm'),
      outPath: path.join(dir, 'out.wav'),
    });
    expect(result).toBeNull();
  });

  test('wavHeader sizes', () => {
    const h = wavHeader({ dataBytes: 400, sampleRate: 16000 });
    expect(h.readUInt32LE(4)).toBe(436);
    expect(h.readUInt32LE(28)).toBe(64000);
    expect(h.readUInt16LE(32)).toBe(4);
  });
});

describe('mixInWorker', () => {
  afterAll(() => closeMixWorkers());
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-mix-worker-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  function tracks(name) {
    const userPath = path.join(dir, `${name}.u.pcm`);
    const agentPath = path.join(dir, `${name}.a.pcm`);
    fs.writeFileSync(userPath, pcm(16000, 300));
    fs.writeFileSync(agentPath, pcm(36000, -400));
    return { userPath, agentPath, outPath: path.join(dir, `${name}.wav`) };
  }

  test('produces the same WAV as the main-thread mix, on a worker thread', async () => {
    const a = tracks('a');
    const b = tracks('b');
    const viaWorker = await mixInWorker(a);
    const inline = await mixToStereoWav(b);
    expect(viaWorker).toEqual(inline);
    expect(fs.readFileSync(a.outPath).equals(fs.readFileSync(b.outPath))).toBe(true);
  });

  test('runs at most MAX_CONCURRENT_MIXES at once and queues the rest', async () => {
    const jobs = ['j1', 'j2', 'j3', 'j4'].map((n) => mixInWorker(tracks(n)));
    const state = mixQueueState();
    expect(state.running).toBeLessThanOrEqual(MAX_CONCURRENT_MIXES);
    expect(state.running + state.queued).toBe(4);
    const results = await Promise.all(jobs);
    expect(results.every((r) => r.durationMs === 1500)).toBe(true);
    expect(mixQueueState()).toEqual({ running: 0, queued: 0 });
  });

  test('falls back to mixing on the main thread when a worker cannot start', async () => {
    const t = tracks('fallback');
    const result = await mixInWorker(t, { workerUrl: 'not-a-valid-worker-path.js' });
    expect(result.durationMs).toBe(1500);
    expect(fs.existsSync(t.outPath)).toBe(true);
  });

  test('a mixing error inside the worker is reported (no silent fallback)', async () => {
    await expect(
      mixInWorker({
        userPath: path.join(dir, 'u.pcm'),
        agentPath: path.join(dir, 'a.pcm'),
        outPath: path.join(dir, 'x.wav'),
        userRate: 8000, // unsupported → worker throws
      })
    ).rejects.toThrow('user track must already be at the output rate');
  });
});

describe('mixInWorker worker reuse', () => {
  afterAll(() => closeMixWorkers());

  test('later recordings reuse the running worker thread', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-mix-reuse-'));
    try {
      const job = (n) => {
        const userPath = path.join(dir, `${n}.u.pcm`);
        fs.writeFileSync(userPath, pcm(1600, 5));
        return {
          userPath,
          agentPath: path.join(dir, 'none.pcm'),
          outPath: path.join(dir, `${n}.wav`),
        };
      };
      await mixInWorker(job(1));
      const { Worker } = await import('worker_threads');
      const before = Worker.prototype.postMessage;
      let posts = 0;
      Worker.prototype.postMessage = function counted(...a) {
        posts += 1;
        return before.apply(this, a);
      };
      try {
        await mixInWorker(job(2));
      } finally {
        Worker.prototype.postMessage = before;
      }
      expect(posts).toBe(1);
      expect(fs.existsSync(path.join(dir, '2.wav'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
