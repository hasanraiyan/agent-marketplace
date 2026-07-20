import { jest } from '@jest/globals';

const mockIncrement = jest.fn();
const mockDelete = jest.fn();
const mockDestroy = jest.fn();

jest.unstable_mockModule('../src/modules/rateLimiter/rateLimiter.repository.js', () => ({
  default: class MockStore {
    increment = mockIncrement;
    delete = mockDelete;
    destroy = mockDestroy;
  },
}));

describe('RateLimiterService', () => {
  let rateLimiterService;

  beforeAll(async () => {
    const mod = await import('../src/modules/rateLimiter/rateLimiter.service.js');
    rateLimiterService = mod.default;
  });

  beforeEach(() => {
    mockIncrement.mockReset();
    mockDelete.mockReset();
    mockDestroy.mockReset();
  });

  describe('buildKey', () => {
    test('should build key from endpoint and ip', () => {
      const key = rateLimiterService.buildKey('login', '192.168.1.1');
      expect(key).toBe('rl:login:192.168.1.1');
    });

    test('should handle different endpoints with same ip', () => {
      const loginKey = rateLimiterService.buildKey('login', '10.0.0.1');
      const registerKey = rateLimiterService.buildKey('register', '10.0.0.1');
      expect(loginKey).not.toBe(registerKey);
    });
  });

  describe('check', () => {
    test('should allow request when under limit', async () => {
      const resetTime = Date.now() + 60_000;
      mockIncrement.mockResolvedValue({ count: 1, resetTime });

      const result = await rateLimiterService.check('rl:login:1.2.3.4', 5, 60_000);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(4);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should allow request at exact limit', async () => {
      const resetTime = Date.now() + 60_000;
      mockIncrement.mockResolvedValue({ count: 5, resetTime });

      const result = await rateLimiterService.check('rl:login:1.2.3.4', 5, 60_000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    test('should deny request when over limit', async () => {
      const resetTime = Date.now() + 60_000;
      mockIncrement.mockResolvedValue({ count: 6, resetTime });

      const result = await rateLimiterService.check('rl:login:1.2.3.4', 5, 60_000);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should return correct retryAfter in seconds', async () => {
      const resetTime = Date.now() + 30_000;
      mockIncrement.mockResolvedValue({ count: 3, resetTime });

      const result = await rateLimiterService.check('rl:login:1.2.3.4', 5, 60_000);

      expect(result.retryAfter).toBeGreaterThanOrEqual(29);
      expect(result.retryAfter).toBeLessThanOrEqual(31);
    });
  });

  describe('reset', () => {
    test('should delete the key from store', async () => {
      mockDelete.mockResolvedValue(undefined);
      await rateLimiterService.reset('rl:login:1.2.3.4');
      expect(mockDelete).toHaveBeenCalledWith('rl:login:1.2.3.4');
    });
  });

  describe('destroy', () => {
    test('should call store destroy when available', () => {
      rateLimiterService.destroy();
      expect(mockDestroy).toHaveBeenCalled();
    });

    test('should not throw when store destroy is not a function', async () => {
      const mod = await import('../src/modules/rateLimiter/rateLimiter.service.js');
      const { RateLimiterService } = mod;

      // Create a service with a store that has no destroy method
      const storeWithoutDestroy = {
        increment: jest.fn(),
        delete: jest.fn(),
      };
      const service = new RateLimiterService(storeWithoutDestroy);

      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe('check edge cases', () => {
    test('should return remaining 0 when count exceeds max', async () => {
      const resetTime = Date.now() + 60_000;
      mockIncrement.mockResolvedValue({ count: 10, resetTime });

      const result = await rateLimiterService.check('rl:login:1.2.3.4', 5, 60_000);

      expect(result.remaining).toBe(0);
      expect(result.allowed).toBe(false);
    });

    test('should handle very high count values', async () => {
      const resetTime = Date.now() + 60_000;
      mockIncrement.mockResolvedValue({ count: 1000, resetTime });

      const result = await rateLimiterService.check('rl:api:1.2.3.4', 100, 60_000);

      expect(result.count).toBe(1000);
      expect(result.remaining).toBe(0);
      expect(result.allowed).toBe(false);
    });

    test('should return positive retryAfter', async () => {
      const resetTime = Date.now() + 5000;
      mockIncrement.mockResolvedValue({ count: 1, resetTime });

      const result = await rateLimiterService.check('rl:login:1.2.3.4', 5, 60_000);

      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });
});
