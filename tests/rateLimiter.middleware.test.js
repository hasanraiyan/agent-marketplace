import { jest } from '@jest/globals';

const mockCheck = jest.fn();
const mockBuildKey = jest.fn();

jest.unstable_mockModule('../src/services/rateLimiter.service.js', () => ({
  default: {
    check: mockCheck,
    buildKey: mockBuildKey,
  },
}));

describe('rateLimiter middleware', () => {
  let rateLimiter, RATE_LIMITS;

  beforeAll(async () => {
    const mod = await import('../src/middlewares/rateLimiter.middleware.js');
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
    mockBuildKey.mockReturnValue('rl:login:127.0.0.1');
  });

  describe('RATE_LIMITS presets', () => {
    test('should export all endpoint presets', () => {
      expect(RATE_LIMITS.LOGIN).toEqual({ maxRequests: 5, windowMs: 15 * 60 * 1000 });
      expect(RATE_LIMITS.REGISTER).toEqual({ maxRequests: 3, windowMs: 60 * 60 * 1000 });
      expect(RATE_LIMITS.FORGOT_PASSWORD).toEqual({ maxRequests: 3, windowMs: 60 * 60 * 1000 });
      expect(RATE_LIMITS.RESET_PASSWORD).toEqual({ maxRequests: 5, windowMs: 15 * 60 * 1000 });
      expect(RATE_LIMITS.RESEND_OTP).toEqual({ maxRequests: 3, windowMs: 5 * 60 * 1000 });
      expect(RATE_LIMITS.VERIFY_OTP).toEqual({ maxRequests: 5, windowMs: 15 * 60 * 1000 });
    });
  });

  describe('middleware behavior', () => {
    test('should call next() when request is allowed', async () => {
      mockCheck.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 4,
        retryAfter: 900,
      });

      const middleware = rateLimiter('login', RATE_LIMITS.LOGIN);
      await middleware(req, res, next);

      expect(mockCheck).toHaveBeenCalledWith('rl:login:127.0.0.1', 5, 15 * 60 * 1000);
      expect(next).toHaveBeenCalledWith();
    });

    test('should set rate limit headers on allowed request', async () => {
      mockCheck.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 4,
        retryAfter: 900,
      });

      const middleware = rateLimiter('login', RATE_LIMITS.LOGIN);
      await middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    test('should call next with RateLimitError when over limit', async () => {
      mockCheck.mockResolvedValue({
        allowed: false,
        count: 6,
        remaining: 0,
        retryAfter: 850,
      });

      const middleware = rateLimiter('login', RATE_LIMITS.LOGIN);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryAfter).toBe(850);
    });

    test('should set Retry-After header when rate limited', async () => {
      mockCheck.mockResolvedValue({
        allowed: false,
        count: 6,
        remaining: 0,
        retryAfter: 850,
      });

      const middleware = rateLimiter('login', RATE_LIMITS.LOGIN);
      await middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('Retry-After', '850');
    });

    test('should use req.ip for key generation', async () => {
      mockCheck.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 4,
        retryAfter: 900,
      });

      const middleware = rateLimiter('register', RATE_LIMITS.REGISTER);
      await middleware(req, res, next);

      expect(mockBuildKey).toHaveBeenCalledWith('register', '127.0.0.1');
    });

    test('should fall back to socket.remoteAddress when req.ip is undefined', async () => {
      req.ip = undefined;
      mockCheck.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 2,
        retryAfter: 3600,
      });

      const middleware = rateLimiter('register', RATE_LIMITS.REGISTER);
      await middleware(req, res, next);

      expect(mockBuildKey).toHaveBeenCalledWith('register', '127.0.0.1');
    });

    test('should call next with error if service throws', async () => {
      const error = new Error('Store failure');
      mockCheck.mockRejectedValue(error);

      const middleware = rateLimiter('login', RATE_LIMITS.LOGIN);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
