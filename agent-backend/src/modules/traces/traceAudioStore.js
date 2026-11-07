import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { PassThrough } from 'stream';
import config from '../../config/index.js';
import { s3Service } from '../../services/storage/index.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Where voice-call recordings live.
 *
 * Recordings are stored in S3-compatible object storage (MinIO in local dev, S3 in prod).
 * Temporary raw PCM files (<traceId>.user.pcm, <traceId>.agent.pcm) are buffered locally
 * during the active call for zero-latency streaming. Upon call termination and mixing,
 * the final stereo <traceId>.wav is pushed to S3 and cleaned up from local disk.
 *
 * Files per traced call (`<traceId>` is a 24-hex ObjectId):
 *   <traceId>.user.pcm   temp, raw PCM s16le 16 kHz mono (during the call)
 *   <traceId>.agent.pcm  temp, raw PCM s16le 24 kHz mono (during the call)
 *   <traceId>.wav        final, stereo 16 kHz (user left, agent right in S3)
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

  /** Storage key of the final recording. */
  keyFor(traceId) {
    return `${safeId(traceId)}.wav`;
  }

  pathForKey(key) {
    return path.join(this.dir(), path.basename(String(key)));
  }

  /** Uploads the locally mixed WAV to S3 and deletes the local file. */
  async finalizeWav(traceId) {
    const key = this.keyFor(traceId);
    const localPath = this.pathForKey(key);
    try {
      if (fs.existsSync(localPath)) {
        const buffer = await fsp.readFile(localPath);
        await s3Service.uploadBuffer({
          bucket: s3Service.privateBucket,
          key: `traces/voice/${key}`,
          buffer,
          contentType: 'audio/wav',
        });
        await fsp.unlink(localPath).catch(() => {});
      }
    } catch (err) {
      logger.warn(`[TraceAudioStore] Failed to upload final WAV to S3: ${err.message}`);
    }
  }

  async stat(key) {
    const local = this.pathForKey(key);
    if (fs.existsSync(local)) {
      try {
        return await fsp.stat(local);
      } catch {
        // Fall back to S3 check
      }
    }

    try {
      const s3Key = `traces/voice/${path.basename(String(key))}`;
      const streamObj = await s3Service.getReadStream({
        bucket: s3Service.privateBucket,
        key: s3Key,
      });
      return { size: streamObj.contentLength };
    } catch {
      return null;
    }
  }

  /** @param {{start?: number, end?: number}} [range] inclusive byte range */
  createReadStream(key, range) {
    const local = this.pathForKey(key);
    if (fs.existsSync(local)) {
      return fs.createReadStream(local, range || undefined);
    }

    const passThrough = new PassThrough();
    const s3Key = `traces/voice/${path.basename(String(key))}`;
    const rangeHeader = range != null ? `bytes=${range.start}-${range.end}` : undefined;

    s3Service
      .getReadStream({
        bucket: s3Service.privateBucket,
        key: s3Key,
        range: rangeHeader,
      })
      .then(({ stream }) => {
        stream.on('error', (err) => passThrough.emit('error', err));
        stream.pipe(passThrough);
      })
      .catch((err) => {
        passThrough.emit('error', err);
      });

    return passThrough;
  }

  async removeTemp(traceId) {
    const { user, agent } = this.tempPaths(traceId);
    await Promise.all([fsp.rm(user, { force: true }), fsp.rm(agent, { force: true })]);
  }

  async remove(traceId) {
    await this.removeTemp(traceId);
    const key = this.keyFor(traceId);
    await fsp.rm(this.pathForKey(key), { force: true });
    await s3Service
      .deleteObject({
        bucket: s3Service.privateBucket,
        key: `traces/voice/${key}`,
      })
      .catch(() => {});
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
