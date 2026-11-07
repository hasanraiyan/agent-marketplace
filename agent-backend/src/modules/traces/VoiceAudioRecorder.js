import fs from 'fs';

/**
 * Records one voice call's audio as two raw PCM tracks on one timeline
 * (milliseconds since the call started), streamed straight to temp files so
 * memory stays flat however long the call runs. `traceAudioMix.js` turns the
 * tracks into the final stereo WAV after the call.
 *
 * The tracks arrive differently, and the recording must match what the
 * people on the call actually heard:
 *  - USER (mic, 16 kHz): real time. Each chunk is placed at its arrival
 *    time; a gap of more than GAP_MS (mic muted, network stall) is filled
 *    with silence.
 *  - AGENT (Gemini, 24 kHz): arrives in bursts faster than real time; the
 *    client buffers and plays it out. A PLAYBACK CURSOR places each chunk at
 *    max(cursor, now). Audio ahead of real time stays in memory (about one
 *    utterance) and is written once real time reaches it. On barge-in the
 *    client throws away what it hasn't played yet, so `interrupt()` drops
 *    the not-yet-played part too.
 *
 * Every method is synchronous bookkeeping plus non-awaited stream writes —
 * nothing here ever delays an audio packet. Any I/O error just stops the
 * recording (`failed`), never the call.
 */

const BYTES = 2;
const GAP_MS = 200;
const SILENCE_CHUNK_SAMPLES = 16000;

export class VoiceAudioRecorder {
  /**
   * @param {object} p
   * @param {{user: string, agent: string}} p.paths temp file paths
   * @param {number} [p.maxMinutes]
   * @param {() => number} [p.now]
   * @param {(path: string) => import('stream').Writable} [p.openStream] injectable for tests
   */
  constructor({
    paths,
    maxMinutes = 15,
    userRate = 16000,
    agentRate = 24000,
    now = () => Date.now(),
    openStream = (p) => fs.createWriteStream(p, { flags: 'w' }),
  }) {
    this.paths = paths;
    this.maxMs = maxMinutes * 60 * 1000;
    this.userRate = userRate;
    this.agentRate = agentRate;
    this.now = now;
    this.openStream = openStream;
    this.startedAt = null;
    this.streams = null;
    this.userWritten = 0; // samples
    this.agentWritten = 0; // samples
    this.agentCursor = 0; // samples (scheduled end of agent playback)
    this.pending = []; // [{ start, buf }] agent audio not yet reached by real time
    this.droppedAgentMs = 0;
    this.truncated = false;
    this.failed = null;
    this.stopped = false;
  }

  get active() {
    return Boolean(this.streams) && !this.stopped && !this.failed;
  }

  start(at = this.now()) {
    if (this.streams) return;
    this.startedAt = at;
    try {
      const user = this.openStream(this.paths.user);
      const agent = this.openStream(this.paths.agent);
      const onError = (err) => this._fail(err);
      user.on?.('error', onError);
      agent.on?.('error', onError);
      this.streams = { user, agent };
    } catch (err) {
      this._fail(err);
    }
  }

  /** Milliseconds since the recording started. */
  elapsedMs() {
    return this.startedAt == null ? 0 : Math.max(0, this.now() - this.startedAt);
  }

  _fail(err) {
    if (this.failed) return;
    this.failed = err instanceof Error ? err : new Error(String(err));
  }

  _write(track, buf) {
    try {
      this.streams[track].write(buf);
    } catch (err) {
      this._fail(err);
    }
  }

  _writeSilence(track, samples) {
    let left = samples;
    while (left > 0) {
      const n = Math.min(left, SILENCE_CHUNK_SAMPLES);
      this._write(track, Buffer.alloc(n * BYTES));
      left -= n;
    }
  }

  _overCap(t) {
    if (t <= this.maxMs) return false;
    if (!this.truncated) {
      this.truncated = true;
      this._commitAgent(this.maxMs, { dropRest: true });
    }
    return true;
  }

  /** One chunk of mic PCM (s16le, userRate) as sent to Gemini. */
  user(buf) {
    if (!this.active || !buf?.length) return;
    const t = this.elapsedMs();
    if (this._overCap(t)) return;
    const data = buf.length % BYTES ? buf.subarray(0, buf.length - 1) : buf;
    const samples = data.length / BYTES;
    const start = Math.round((t * this.userRate) / 1000) - samples;
    const gap = start - this.userWritten;
    if (gap > (GAP_MS * this.userRate) / 1000) {
      this._writeSilence('user', gap);
      this.userWritten += gap;
    }
    this._write('user', data);
    this.userWritten += samples;
    this._commitAgent(t);
  }

  /**
   * One chunk of agent PCM (s16le, agentRate) from Gemini.
   * @returns {{startMs: number, endMs: number} | null} where it plays
   */
  agent(buf) {
    if (!this.active || !buf?.length) return null;
    const t = this.elapsedMs();
    if (this._overCap(t)) return null;
    const data = buf.length % BYTES ? buf.subarray(0, buf.length - 1) : buf;
    const samples = data.length / BYTES;
    const nowS = Math.round((t * this.agentRate) / 1000);
    const start = Math.max(this.agentCursor, nowS);
    this.pending.push({ start, buf: Buffer.from(data) });
    this.agentCursor = start + samples;
    this._commitAgent(t);
    return { startMs: this._agentMs(start), endMs: this._agentMs(this.agentCursor) };
  }

  /** Barge-in: drop the agent audio the listener never heard. */
  interrupt() {
    if (!this.active) return;
    const t = this.elapsedMs();
    this._commitAgent(t, { dropRest: true });
  }

  /** Scheduled end of the agent's audio so far, in ms on the call timeline. */
  agentCursorMs() {
    return this._agentMs(Math.max(this.agentCursor, this.agentWritten));
  }

  _agentMs(samples) {
    return Math.round((samples * 1000) / this.agentRate);
  }

  _commitAgent(t, { dropRest = false } = {}) {
    const nowS = Math.round((t * this.agentRate) / 1000);
    const keep = [];
    for (const item of this.pending) {
      const len = item.buf.length / BYTES;
      const end = item.start + len;
      if (end <= nowS) {
        this._flushAgentItem(item.start, item.buf);
      } else if (dropRest) {
        if (item.start < nowS) {
          const playedSamples = nowS - item.start;
          this._flushAgentItem(item.start, item.buf.subarray(0, playedSamples * BYTES));
          this.droppedAgentMs += this._agentMs(len - playedSamples);
        } else {
          this.droppedAgentMs += this._agentMs(len);
        }
      } else {
        keep.push(item);
      }
    }
    this.pending = keep;
    if (dropRest) this.agentCursor = Math.max(this.agentWritten, Math.min(this.agentCursor, nowS));
  }

  _flushAgentItem(start, buf) {
    const gap = start - this.agentWritten;
    if (gap > 0) {
      this._writeSilence('agent', gap);
      this.agentWritten += gap;
    }
    this._write('agent', buf);
    this.agentWritten += buf.length / BYTES;
  }

  /**
   * Ends the recording: writes the agent audio played so far, drops the
   * rest, and closes both files.
   * @returns {Promise<{durationMs: number, truncated: boolean, droppedAgentMs: number, failed: Error|null}>}
   */
  async stop() {
    if (this.stopped || !this.streams) {
      this.stopped = true;
      return this._summary();
    }
    if (!this.failed) this._commitAgent(Math.min(this.elapsedMs(), this.maxMs), { dropRest: true });
    this.stopped = true;
    const end = (s) =>
      new Promise((resolve) => {
        try {
          s.end(() => resolve());
        } catch {
          resolve();
        }
      });
    await Promise.all([end(this.streams.user), end(this.streams.agent)]);
    return this._summary();
  }

  _summary() {
    return {
      durationMs: Math.min(this.elapsedMs(), this.maxMs),
      truncated: this.truncated,
      droppedAgentMs: this.droppedAgentMs,
      failed: this.failed,
    };
  }
}

export default VoiceAudioRecorder;
