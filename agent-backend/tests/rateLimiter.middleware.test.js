import { jest } from '@jest/globals';

const mockCheck = jest.fn();
const mockBuildKey = jest.fn();

jest.unstable_mockModule('../src/modules/rateLimiter/rateLimiter.service.js', () => ({
  default: {
    check: mockCheck,
    buildKey: mockBuildKey,
  },
}));

describe('rateLimiter middleware', () => {
  let rateLimiter, RATE_LIMITS;

  beforeAll(async () => {
    const mod = await import('../src/modules/rateLimiter/rateLimiter.middleware.js');
    rateLimiter = mod.default;
    RATE_LIMITS = mod.RATE_LIMITS;
  });

  let req, res, next;

  beforeEach(() => {
    req = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } };
    res = {
      set: jest.fn(),
    };
    next = jest.fn();
    mockCheck.mockReset();
    mockBuildKey.mockReturnValue('rl:CHAT:127.0.0.1');
  });

  describe('RATE_LIMITS presets', () => {
    test('should export core presets', () => {
      expect(RATE_LIMITS.CHAT).toEqual({ maxRequests: 20, windowMs: 60 * 1000 });
      expect(RATE_LIMITS.MUTATE).toEqual({ maxRequests: 30, windowMs: 60 * 1000 });
    });
  });

  describe('middleware behavior', () => {
    test('should call next() when request is allowed', async () => {
      mockCheck.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 19,
        retryAfter: 60,
      });

      const middleware = rateLimiter('CHAT', RATE_LIMITS.CHAT);
      await middleware(req, res, next);

      expect(mockCheck).toHaveBeenCalledWith('rl:CHAT:127.0.0.1', 20, 60 * 1000);
      expect(next).toHaveBeenCalledWith();
    });

    test('should set rate limit headers on allowed request', async () => {
      mockCheck.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 19,
        retryAfter: 60,
      });

      const middleware = rateLimiter('CHAT', RATE_LIMITS.CHAT);
      await middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Limit', '20');
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '19');
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    test('should call next with RateLimitError when over limit', async () => {
      mockCheck.mockResolvedValue({
        allowed: false,
        count: 21,
        remaining: 0,
        retryAfter: 45,
      });

      const middleware = rateLimiter('CHAT', RATE_LIMITS.CHAT);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryAfter).toBe(45);
    });

    test('should set Retry-After header when rate limited', async () => {
      mockCheck.mockResolvedValue({
        allowed: false,
        count: 21,
        remaining: 0,
        retryAfter: 45,
      });

      const middleware = rateLimiter('CHAT', RATE_LIMITS.CHAT);
      await middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('Retry-After', '45');
    });

    test('should use req.user._id if available for key generation', async () => {
      req.user = { _id: 'user123' };
      mockCheck.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 19,
        retryAfter: 60,
      });

      const middleware = rateLimiter('CHAT', RATE_LIMITS.CHAT);
      await middleware(req, res, next);

      expect(mockBuildKey).toHaveBeenCalledWith('CHAT', 'user123');
    });

    test('should use req.ip for key generation as fallback', async () => {
      mockCheck.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 19,
        retryAfter: 60,
      });

      const middleware = rateLimiter('CHAT', RATE_LIMITS.CHAT);
      await middleware(req, res, next);

      expect(mockBuildKey).toHaveBeenCalledWith('CHAT', '127.0.0.1');
    });

    test('should fall back to socket.remoteAddress when req.ip is undefined', async () => {
      req.ip = undefined;
      mockCheck.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 19,
        retryAfter: 60,
      });

      const middleware = rateLimiter('CHAT', RATE_LIMITS.CHAT);
      await middleware(req, res, next);

      expect(mockBuildKey).toHaveBeenCalledWith('CHAT', '127.0.0.1');
    });

    test('should call next with error if service throws', async () => {
      const error = new Error('Store failure');
      mockCheck.mockRejectedValue(error);

      const middleware = rateLimiter('CHAT', RATE_LIMITS.CHAT);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
