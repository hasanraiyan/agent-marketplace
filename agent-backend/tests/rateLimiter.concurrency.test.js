import rateLimiterService from '../src/services/rateLimiter.service.js';

describe('RateLimiterService Concurrency', () => {
  beforeEach(() => {
    rateLimiterService.destroy();
  });

  test('should track concurrency correctly', () => {
    const key = 'test-concurrency';
    expect(rateLimiterService.getConcurrency(key)).toBe(0);

    rateLimiterService.incrementConcurrency(key);
    expect(rateLimiterService.getConcurrency(key)).toBe(1);

    rateLimiterService.incrementConcurrency(key);
    expect(rateLimiterService.getConcurrency(key)).toBe(2);

    rateLimiterService.decrementConcurrency(key);
    expect(rateLimiterService.getConcurrency(key)).toBe(1);

    rateLimiterService.decrementConcurrency(key);
    expect(rateLimiterService.getConcurrency(key)).toBe(0);
  });

  test('should handle decrementing below zero', () => {
    const key = 'test-concurrency-zero';
    rateLimiterService.decrementConcurrency(key);
    expect(rateLimiterService.getConcurrency(key)).toBe(0);
  });
});
