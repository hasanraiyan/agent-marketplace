import fsp from 'fs/promises';
import { Worker } from 'worker_threads';

/**
 * Mixes the two raw PCM tracks of a recorded voice call into one stereo
 * WAV: the user on the left channel, the agent on the right, both at
 * `outRate`. The agent track is resampled with linear interpolation (good
 * enough for speech).
 *
 * Production path: `mixInWorker()` runs the mix on a worker thread (at most
 * MAX_CONCURRENT_MIXES at once, the rest queue), so the main event loop that
 * carries every live call never does the per-sample work. If a worker can't
 * start, it falls back to mixing here, one second at a time, yielding to the
 * event loop between blocks.
 */

const BYTES = 2; // s16le

export function wavHeader({ dataBytes, sampleRate, channels = 2 }) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16); // fmt chunk size
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * channels * BYTES, 28); // byte rate
  h.writeUInt16LE(channels * BYTES, 32); // block align
  h.writeUInt16LE(16, 34); // bits per sample
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(dataBytes, 40);
  return h;
}

async function sizeOf(p) {
  try {
    return (await fsp.stat(p)).size;
  } catch {
    return 0;
  }
}

async function readSamples(fh, startSample, count) {
  if (!fh || count <= 0) return Buffer.alloc(0);
  const buf = Buffer.alloc(count * BYTES);
  const { bytesRead } = await fh.read(buf, 0, buf.length, startSample * BYTES);
  return buf.subarray(0, bytesRead - (bytesRead % BYTES));
}

const yieldLoop = () => new Promise((r) => setImmediate(r));

/**
 * @returns {Promise<null | {bytes: number, durationMs: number, sampleRate: number}>}
 *   null when both tracks are empty (nothing recorded).
 */
export async function mixToStereoWav({
  userPath,
  agentPath,
  outPath,
  userRate = 16000,
  agentRate = 24000,
  outRate = 16000,
  // Yield to the event loop between 1-second blocks. Needed only when
  // mixing on the main thread (the fallback); the worker passes 0.
  yieldEvery = 1,
}) {
  if (userRate !== outRate) throw new Error('user track must already be at the output rate');
  const userLen = Math.floor((await sizeOf(userPath)) / BYTES);
  const agentLen = Math.floor((await sizeOf(agentPath)) / BYTES);
  const ratio = agentRate / outRate;
  const outLen = Math.max(userLen, Math.floor(agentLen / ratio));
  if (outLen === 0) return null;

  const userFh = userLen ? await fsp.open(userPath, 'r') : null;
  const agentFh = agentLen ? await fsp.open(agentPath, 'r') : null;
  const out = await fsp.open(outPath, 'w');
  try {
    const dataBytes = outLen * 2 * BYTES;
    await out.write(wavHeader({ dataBytes, sampleRate: outRate, channels: 2 }), 0, 44, 0);
    let pos = 44;
    const block = outRate; // 1 s per block
    for (let o = 0; o < outLen; o += block) {
      const n = Math.min(block, outLen - o);
      const ub = await readSamples(userFh, o, Math.min(n, Math.max(0, userLen - o)));
      const a0 = Math.floor(o * ratio);
      const a1 = Math.min(agentLen, Math.ceil((o + n) * ratio) + 2);
      const ab = await readSamples(agentFh, a0, a1 - a0);
      const abLen = ab.length / BYTES;
      const frame = Buffer.alloc(n * 2 * BYTES);
      for (let k = 0; k < n; k += 1) {
        const u = k * BYTES < ub.length ? ub.readInt16LE(k * BYTES) : 0;
        const p = (o + k) * ratio - a0;
        const i = Math.floor(p);
        let a = 0;
        if (i < abLen) {
          const s0 = ab.readInt16LE(i * BYTES);
          const s1 = i + 1 < abLen ? ab.readInt16LE((i + 1) * BYTES) : s0;
          a = Math.round(s0 + (s1 - s0) * (p - i));
        }
        frame.writeInt16LE(u, k * 4);
        frame.writeInt16LE(Math.max(-32768, Math.min(32767, a)), k * 4 + 2);
      }
      await out.write(frame, 0, frame.length, pos);
      pos += frame.length;
      if (yieldEvery) await yieldLoop();
    }
    return { bytes: pos, durationMs: Math.round((outLen / outRate) * 1000), sampleRate: outRate };
  } finally {
    await Promise.all([userFh?.close(), agentFh?.close(), out.close()]);
  }
}

// ── worker thread ─────────────────────────────────────────────────────────

const WORKER_URL = new URL('./traceAudioMix.worker.js', import.meta.url);
// Mixing is short (seconds even for a 15-minute call); two at a time keeps
// CPU free for live calls when many calls end together.
export const MAX_CONCURRENT_MIXES = 2;
// A worker that hangs is killed rather than holding a slot forever.
const WORKER_TIMEOUT_MS = 2 * 60 * 1000;

let running = 0;
const queue = [];

function runNext() {
  while (running < MAX_CONCURRENT_MIXES && queue.length) {
    const job = queue.shift();
    running += 1;
    job.start().finally(() => {
      running -= 1;
      runNext();
    });
  }
}

// Idle, reusable workers (started on first use, kept for later recordings —
// starting a thread costs ~10 ms on the main thread, so it is paid once,
// not per recording). unref'd so they never keep the process alive.
const idle = new Map(); // workerUrl string -> Worker[]
let nextJobId = 0;

function takeWorker(workerUrl) {
  const list = idle.get(String(workerUrl)) || [];
  const w = list.pop();
  if (w) return w;
  const worker = new Worker(workerUrl);
  worker.unref();
  return worker;
}

function giveBack(workerUrl, worker) {
  const key = String(workerUrl);
  if (!idle.has(key)) idle.set(key, []);
  idle.get(key).push(worker);
}

function discard(workerUrl, worker) {
  const list = idle.get(String(workerUrl));
  if (list)
    idle.set(
      String(workerUrl),
      list.filter((w) => w !== worker)
    );
  worker.terminate().catch(() => {});
}

/** Runs one mix on a pooled worker thread. Rejects (workerStartFailed) if no worker can start. */
function runWorker(args, { workerUrl = WORKER_URL, timeoutMs = WORKER_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = takeWorker(workerUrl);
    } catch (err) {
      reject(Object.assign(err, { workerStartFailed: true }));
      return;
    }
    const id = ++nextJobId;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    };
    const finish = (fn, value, { healthy }) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (healthy) giveBack(workerUrl, worker);
      else discard(workerUrl, worker);
      fn(value);
    };
    const onMessage = (msg) => {
      if (msg?.id !== id) return;
      if (msg.ok) finish(resolve, msg.result, { healthy: true });
      else finish(reject, new Error(msg.error || 'Mixing failed'), { healthy: true });
    };
    const onError = (err) => {
      // The worker's own file failed to load: treat as "couldn't start".
      if (/^ERR_(MODULE_NOT_FOUND|WORKER_|UNKNOWN_FILE)/.test(err?.code || '')) {
        err.workerStartFailed = true;
      }
      finish(reject, err, { healthy: false });
    };
    const onExit = (code) =>
      finish(reject, new Error(`Mixing worker exited with code ${code}`), { healthy: false });
    const timer = setTimeout(
      () => finish(reject, new Error('Mixing the recording timed out'), { healthy: false }),
      timeoutMs
    );
    timer.unref?.();
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);
    worker.postMessage({ id, args });
  });
}

/** For tests / shutdown: stops every idle worker. */
export async function closeMixWorkers() {
  const all = [...idle.values()].flat();
  idle.clear();
  await Promise.all(all.map((w) => w.terminate().catch(() => {})));
}

/**
 * Mixes a recording on a worker thread (queued, max MAX_CONCURRENT_MIXES at
 * once). Same arguments and result as mixToStereoWav. If the worker cannot
 * be started at all, mixes on the main thread instead (yielding between
 * 1-second blocks) so the recording is still produced.
 */
export function mixInWorker(args, opts = {}) {
  return new Promise((resolve, reject) => {
    queue.push({
      start: () =>
        runWorker(args, opts)
          .catch((err) => (err?.workerStartFailed ? mixToStereoWav(args) : Promise.reject(err)))
          .then(resolve, reject),
    });
    runNext();
  });
}

/** For tests: how many mixes are running / waiting. */
export function mixQueueState() {
  return { running, queued: queue.length };
}

export default mixToStereoWav;
