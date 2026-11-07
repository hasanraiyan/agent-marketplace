import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import { TraceAudioStore, S3_PREFIX } from '../src/modules/traces/traceAudioStore.js';

const ID = 'dddddddddddddddddddddddd';
const OTHER = 'eeeeeeeeeeeeeeeeeeeeeeee';

/** In-memory stand-in for s3Service (no network in tests). */
function fakeS3(objects = {}) {
  const s3 = {
    privateBucket: 'private',
    objects, // key -> { body: Buffer, lastModified: Date }
    deletedKeys: [],
    heads: 0,
    gets: 0,
    async headObject({ key }) {
      s3.heads += 1;
      const o = s3.objects[key];
      return o ? { contentLength: o.body.length, lastModified: o.lastModified } : null;
    },
    async getReadStream({ key, range }) {
      s3.gets += 1;
      const o = s3.objects[key];
      if (!o) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
      const m = range && /bytes=(d+)-(d+)/.exec(range);
      const body = m ? o.body.subarray(Number(m[1]), Number(m[2]) + 1) : o.body;
      const stream = new PassThrough();
      stream.end(body);
      return { stream, contentLength: body.length };
    },
    async *listObjects({ prefix }) {
      for (const [key, o] of Object.entries(s3.objects)) {
        if (key.startsWith(prefix)) yield { key, size: o.body.length, lastModified: o.lastModified };
      }
    },
    async deleteObjects({ keys }) {
      for (const k of keys) delete s3.objects[k];
      s3.deletedKeys.push(...keys);
      return { deleted: keys.length };
    },
    async deleteObject({ key }) {
      delete s3.objects[key];
      s3.deletedKeys.push(key);
    },
    async uploadBuffer({ key, buffer }) {
      s3.objects[key] = { body: Buffer.from(buffer), lastModified: new Date() };
    },
  };
  return s3;
}

describe('TraceAudioStore (local disk)', () => {
  let dir;
  let store;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-store-'));
    store = new TraceAudioStore({ dir, s3: fakeS3() });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('rejects ids that are not ObjectIds (no path tricks)', () => {
    expect(() => store.tempPaths('../etc')).toThrow();
    expect(() => store.keyFor('x/../../y')).toThrow();
    expect(path.dirname(store.pathForKey('../../evil.wav'))).toBe(path.resolve(dir));
  });

  test('stat / read stream / remove', async () => {
    fs.writeFileSync(path.join(dir, `${ID}.wav`), 'RIFFdata');
    expect((await store.stat(store.keyFor(ID))).size).toBe(8);
    const chunks = [];
    await new Promise((resolve) => {
      store
        .createReadStream(store.keyFor(ID), { start: 4, end: 7 })
        .on('data', (c) => chunks.push(c))
        .on('end', resolve);
    });
    expect(Buffer.concat(chunks).toString()).toBe('data');
    await store.remove(ID);
    expect(await store.stat(store.keyFor(ID))).toBeNull();
  });

  test('sweep deletes old recordings, stale temp files and orphans', async () => {
    const old = Date.now() / 1000 - 40 * 86400;
    const write = (name, ageSec) => {
      const p = path.join(dir, name);
      fs.writeFileSync(p, 'x');
      if (ageSec) fs.utimesSync(p, ageSec, ageSec);
      return p;
    };
    const oldWav = write(`${ID}.wav`, old);
    const freshWav = write(`${OTHER}.wav`);
    const oldTemp = write(`${OTHER}.user.pcm`, Date.now() / 1000 - 2 * 86400);
    const freshTemp = write(`${ID}.agent.pcm`);
    const unrelated = write('notes.txt', old);

    const { deleted } = await store.sweep({
      olderThanMs: 30 * 86400000,
      isKnown: async () => true,
    });
    expect(deleted).toBe(2);
    expect(fs.existsSync(oldWav)).toBe(false);
    expect(fs.existsSync(oldTemp)).toBe(false);
    expect(fs.existsSync(freshWav)).toBe(true);
    expect(fs.existsSync(freshTemp)).toBe(true);
    expect(fs.existsSync(unrelated)).toBe(true);

    await store.sweep({ olderThanMs: 30 * 86400000, isKnown: async (id) => id !== OTHER });
    expect(fs.existsSync(freshWav)).toBe(false); // its trace is gone
  });

  test('sweep on a missing folder is a no-op', async () => {
    const s = new TraceAudioStore({ dir: path.join(dir, 'nope'), s3: fakeS3() });
    await expect(s.sweep({ olderThanMs: 1 })).resolves.toMatchObject({ deleted: 0 });
  });
});

describe('TraceAudioStore (S3)', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-store-s3-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('finalizeWav uploads the WAV under the voice prefix and removes the local copy', async () => {
    const s3 = fakeS3();
    const store = new TraceAudioStore({ dir, s3 });
    fs.writeFileSync(path.join(dir, ), 'RIFFdata');
    await store.finalizeWav(ID);
    expect(s3.objects[].body.toString()).toBe('RIFFdata');
    expect(fs.existsSync(path.join(dir, ))).toBe(false);
  });

  test('stat() sizes an S3 recording with a HEAD request, never a download', async () => {
    const s3 = fakeS3({ []: { body: Buffer.alloc(1234), lastModified: new Date() } });
    const store = new TraceAudioStore({ dir, s3 });
    expect((await store.stat()).size).toBe(1234);
    expect(s3.heads).toBe(1);
    expect(s3.gets).toBe(0);
    expect(await store.stat()).toBeNull();
  });

  test('createReadStream streams a byte range from S3', async () => {
    const s3 = fakeS3({
      []: { body: Buffer.from('RIFFdata'), lastModified: new Date() },
    });
    const store = new TraceAudioStore({ dir, s3 });
    const chunks = [];
    await new Promise((resolve, reject) => {
      store
        .createReadStream(, { start: 4, end: 7 })
        .on('data', (c) => chunks.push(c))
        .on('end', resolve)
        .on('error', reject);
    });
    expect(Buffer.concat(chunks).toString()).toBe('data');
  });

  test('sweep deletes old and orphaned recordings in S3, keeps fresh ones', async () => {
    const old = new Date(Date.now() - 40 * 86400000);
    const THIRD = 'ffffffffffffffffffffffff';
    const s3 = fakeS3({
      []: { body: Buffer.alloc(1), lastModified: old },
      []: { body: Buffer.alloc(1), lastModified: new Date() },
      []: { body: Buffer.alloc(1), lastModified: new Date() },
      'other-prefix/keep.wav': { body: Buffer.alloc(1), lastModified: old },
    });
    const store = new TraceAudioStore({ dir, s3 });
    const result = await store.sweep({
      olderThanMs: 30 * 86400000,
      isKnown: async (id) => id !== THIRD, // THIRD's trace is gone
    });
    expect(result).toMatchObject({ deletedS3: 2, deletedLocal: 0, deleted: 2 });
    expect(s3.deletedKeys.sort()).toEqual([, ].sort());
    expect(s3.objects[]).toBeDefined();
    expect(s3.objects['other-prefix/keep.wav']).toBeDefined();
  });

  test('an S3 outage during sweep is logged, local cleanup still counts', async () => {
    const s3 = fakeS3();
    s3.listObjects = async function* broken() {
      throw new Error('S3 unreachable');
    };
    const store = new TraceAudioStore({ dir, s3 });
    const p = path.join(dir, );
    fs.writeFileSync(p, 'x');
    const t = Date.now() / 1000 - 2 * 86400;
    fs.utimesSync(p, t, t);
    await expect(store.sweep({ olderThanMs: 1 })).resolves.toMatchObject({ deletedLocal: 1, deletedS3: 0 });
  });
});
