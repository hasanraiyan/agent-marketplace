import { jest, describe, test, expect, beforeEach } from '@jest/globals';

/**
 * upsertMemoryFile exists to survive the concurrent-insert race on the unique
 * { namespace, key } index: two simultaneous upserts of a key that does not
 * exist yet can both pass the find and both attempt the insert, and the loser
 * gets E11000. In production that surfaced to the model as a failed memory
 * tool call, costing it the turn.
 *
 * Mongoose is mocked rather than driven against a real mongod: the repo's test
 * config points at a live database, and this behaviour is about how one driver
 * error is handled, not about the database itself.
 */

const findOneAndUpdate = jest.fn();

jest.unstable_mockModule('mongoose', () => ({
  default: {
    Schema: class {
      constructor() {
        this.index = () => this;
      }
      index() {
        return this;
      }
    },
    model: () => ({ findOneAndUpdate }),
  },
}));

const { upsertMemoryFile } = await import('../src/modules/memory/memory-file.model.js');

const FILTER = { namespace: ['users', 'u1'], key: '/index.md' };
const UPDATE = { $set: { content: 'hello' } };

const duplicateKeyError = () => Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });

describe('upsertMemoryFile', () => {
  beforeEach(() => findOneAndUpdate.mockReset());

  test('returns the document when the upsert succeeds first time', async () => {
    findOneAndUpdate.mockResolvedValueOnce({ _id: 'doc1' });

    await expect(upsertMemoryFile(FILTER, UPDATE)).resolves.toEqual({ _id: 'doc1' });
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).toHaveBeenCalledWith(FILTER, UPDATE, { upsert: true, new: true });
  });

  test('retries once without upsert when the insert race throws E11000', async () => {
    findOneAndUpdate.mockRejectedValueOnce(duplicateKeyError());
    findOneAndUpdate.mockResolvedValueOnce({ _id: 'doc1', content: 'hello' });

    await expect(upsertMemoryFile(FILTER, UPDATE)).resolves.toEqual({
      _id: 'doc1',
      content: 'hello',
    });

    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    // The retry must drop `upsert` - the loser of the race is retrying because
    // the document now exists, so asking to insert it again would race afresh.
    expect(findOneAndUpdate).toHaveBeenLastCalledWith(FILTER, UPDATE, { new: true });
  });

  test('does not swallow errors that are not duplicate-key', async () => {
    const boom = Object.assign(new Error('connection lost'), { code: 89 });
    findOneAndUpdate.mockRejectedValueOnce(boom);

    await expect(upsertMemoryFile(FILTER, UPDATE)).rejects.toThrow('connection lost');
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
