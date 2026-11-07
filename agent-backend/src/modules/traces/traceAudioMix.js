import fsp from 'fs/promises';

/**
 * Mixes the two raw PCM tracks of a recorded voice call into one stereo
 * WAV: the user on the left channel, the agent on the right, both at
 * `outRate`. The agent track is resampled with linear interpolation (good
 * enough for speech). Works one second at a time and yields to the event
 * loop between blocks, so even a 15-minute call never blocks live sessions.
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
      await yieldLoop();
    }
    return { bytes: pos, durationMs: Math.round((outLen / outRate) * 1000), sampleRate: outRate };
  } finally {
    await Promise.all([userFh?.close(), agentFh?.close(), out.close()]);
  }
}

export default mixToStereoWav;
