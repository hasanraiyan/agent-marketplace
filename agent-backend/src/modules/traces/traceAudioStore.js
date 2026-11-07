import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import config from '../../config/index.js';

/**
 * Where voice-call recordings live. Local disk only for now (one folder,
 * TRACE_AUDIO_DIR); every read/write goes through this module so an S3/R2
 * backend can be added later without touching the recorder or the API.
 *
 * Files per traced call (`<traceId>` is a 24-hex ObjectId):
 *   <traceId>.user.pcm   temp, raw PCM s16le 16 kHz mono (during the call)
 *   <traceId>.agent.pcm  temp, raw PCM s16le 24 kHz mono (during the call)
 *   <traceId>.wav        final, stereo 16 kHz (user left, agent right)
 */

const ID_RE = /^[a-f0-9]{24}$/i;

function safeId(traceId) {
  const id = String(traceId);
  if (!ID_RE.test(id)) throw new Error('Invalid trace id for audio storage');
  return id;
}

class TraceAudioStore {
  constructor({ dir } = {}) {
    this._dir = dir || null;
  }

  dir() {
    return path.resolve(process.cwd(), this._dir || config.traces.voiceAudio.dir);
  }

  async ensureDir() {
    await fsp.mkdir(this.dir(), { recursive: true });
  }

  /** Once per recorded call, before its temp streams open. */
  ensureDirSync() {
    fs.mkdirSync(this.dir(), { recursive: true });
  }

  tempPaths(traceId) {
    const id = safeId(traceId);
    return {
      user: path.join(this.dir(), `${id}.user.pcm`),
      agent: path.join(this.dir(), `${id}.agent.pcm`),
    };
  }

  /** Storage key of the final recording (a file name inside dir()). */
  keyFor(traceId) {
    return `${safeId(traceId)}.wav`;
  }

  pathForKey(key) {
    return path.join(this.dir(), path.basename(String(key)));
  }

  async stat(key) {
    try {
      return await fsp.stat(this.pathForKey(key));
    } catch {
      return null;
    }
  }

  /** @param {{start?: number, end?: number}} [range] inclusive byte range */
  createReadStream(key, range) {
    return fs.createReadStream(this.pathForKey(key), range || undefined);
  }

  async removeTemp(traceId) {
    const { user, agent } = this.tempPaths(traceId);
    await Promise.all([fsp.rm(user, { force: true }), fsp.rm(agent, { force: true })]);
  }

  async remove(traceId) {
    await this.removeTemp(traceId);
    await fsp.rm(this.pathForKey(this.keyFor(traceId)), { force: true });
  }

  /**
   * Deletes recordings older than `olderThanMs`, temp files older than
   * `tempOlderThanMs`, and (when `isKnown` is given) recordings whose trace
   * no longer exists.
   * @returns {Promise<{deleted: number}>}
   */
  async sweep({ olderThanMs, tempOlderThanMs = 24 * 60 * 60 * 1000, isKnown } = {}) {
    let names;
    try {
      names = await fsp.readdir(this.dir());
    } catch {
      return { deleted: 0 };
    }
    const now = Date.now();
    let deleted = 0;
    for (const name of names) {
      const isTemp = name.endsWith('.pcm');
      const isWav = name.endsWith('.wav');
      if (!isTemp && !isWav) continue;
      const full = path.join(this.dir(), name);
      let st;
      try {
        st = await fsp.stat(full);
      } catch {
        continue;
      }
      const age = now - st.mtimeMs;
      let drop = isTemp ? age > tempOlderThanMs : olderThanMs != null && age > olderThanMs;
      if (!drop && isWav && typeof isKnown === 'function') {
        const id = name.slice(0, -4);
        if (ID_RE.test(id) && !(await isKnown(id))) drop = true;
      }
      if (drop) {
        await fsp.rm(full, { force: true }).catch(() => {});
        deleted += 1;
      }
    }
    return { deleted };
  }
}

export { TraceAudioStore };
export default new TraceAudioStore();
