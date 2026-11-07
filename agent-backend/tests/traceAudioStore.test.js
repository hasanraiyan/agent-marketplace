import fs from 'fs';
import os from 'os';
import path from 'path';
import { TraceAudioStore } from '../src/modules/traces/traceAudioStore.js';

const ID = 'dddddddddddddddddddddddd';
const OTHER = 'eeeeeeeeeeeeeeeeeeeeeeee';

describe('TraceAudioStore (local disk)', () => {
  let dir;
  let store;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-store-'));
    store = new TraceAudioStore({ dir });
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
    const s = new TraceAudioStore({ dir: path.join(dir, 'nope') });
    await expect(s.sweep({ olderThanMs: 1 })).resolves.toEqual({ deleted: 0 });
  });
});
