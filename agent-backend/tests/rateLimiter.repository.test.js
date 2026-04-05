import { jest } from '@jest/globals';
import InMemoryRateLimitStore from '../src/repositories/rateLimiter.repository.js';

describe('InMemoryRateLimitStore', () => {
  let store;

  beforeEach(() => {
    store = new InMemoryRateLimitStore(60_000);
  });

  afterEach(() => {
    store.destroy();
  });

  describe('get', () => {
    test('should return null for non-existent key', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeNull();
    });

    test('should return entry for existing key', async () => {
      const resetTime = Date.now() + 10_000;
      await store.set('test-key', { count: 3, resetTime });
      const result = await store.get('test-key');
      expect(result).toEqual({ count: 3, resetTime });
    });

    test('should return null and delete expired entry', async () => {
      const resetTime = Date.now() - 1000;
      await store.set('expired-key', { count: 5, resetTime });
      const result = await store.get('expired-key');
      expect(result).toBeNull();
      const afterDelete = await store.get('expired-key');
      expect(afterDelete).toBeNull();
    });
  });

  describe('set', () => {
    test('should store and retrieve data', async () => {
      const data = { count: 1, resetTime: Date.now() + 5000 };
      await store.set('key', data);
      const result = await store.get('key');
      expect(result).toEqual(data);
    });

    test('should overwrite existing key', async () => {
      await store.set('key', { count: 1, resetTime: Date.now() + 5000 });
      const newData = { count: 10, resetTime: Date.now() + 10_000 };
      await store.set('key', newData);
      const result = await store.get('key');
      expect(result).toEqual(newData);
    });
  });

  describe('increment', () => {
    test('should create new entry on first increment', async () => {
      const result = await store.increment('new-key', 60_000);
      expect(result.count).toBe(1);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    test('should increment existing entry within window', async () => {
      await store.increment('key', 60_000);
      await store.increment('key', 60_000);
      const result = await store.increment('key', 60_000);
      expect(result.count).toBe(3);
    });

    test('should reset counter when window expires', async () => {
      await store.set('key', { count: 5, resetTime: Date.now() - 1000 });
      const result = await store.increment('key', 60_000);
      expect(result.count).toBe(1);
    });
  });

  describe('delete', () => {
    test('should remove entry', async () => {
      await store.set('key', { count: 1, resetTime: Date.now() + 5000 });
      await store.delete('key');
      const result = await store.get('key');
      expect(result).toBeNull();
    });

    test('should not throw on non-existent key', async () => {
      await expect(store.delete('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('cleanup', () => {
    test('should remove expired entries on interval', async () => {
      jest.useFakeTimers();
      const cleanupStore = new InMemoryRateLimitStore(1000);

      await cleanupStore.set('expired', { count: 1, resetTime: Date.now() - 500 });
      await cleanupStore.set('valid', { count: 1, resetTime: Date.now() + 10_000 });

      jest.advanceTimersByTime(1500);

      // Allow microtasks to flush
      await Promise.resolve();

      const expired = await cleanupStore.get('expired');
      const valid = await cleanupStore.get('valid');

      expect(expired).toBeNull();
      expect(valid).not.toBeNull();

      cleanupStore.destroy();
      jest.useRealTimers();
    });
  });
});
