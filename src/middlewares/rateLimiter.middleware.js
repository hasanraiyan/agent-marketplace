import rateLimiterService from '../services/rateLimiter.service.js';
import RateLimitError from '../utils/errors/RateLimitError.js';

/**
 * Rate limit presets for auth endpoints
 */
export const RATE_LIMITS = {
  LOGIN: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  REGISTER: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  FORGOT_PASSWORD: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  RESET_PASSWORD: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  RESEND_OTP: { maxRequests: 3, windowMs: 5 * 60 * 1000 },
  VERIFY_OTP: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
};

/**
 * Factory that creates rate limiter middleware
 *
 * Single Responsibility: Only handles HTTP request/response concerns
 * Open/Closed: New presets can be added without modifying middleware logic
 *
 * @param {string} endpoint - Endpoint identifier for key generation
 * @param {{ maxRequests: number, windowMs: number }} options - Rate limit config
 * @returns {Function} Express middleware
 */
const rateLimiter = (endpoint, { maxRequests, windowMs }) => {
  return async (req, res, next) => {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const key = rateLimiterService.buildKey(endpoint, ip);
      const result = await rateLimiterService.check(key, maxRequests, windowMs);

      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(result.remaining));
      res.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000 + result.retryAfter)));

      if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfter));
        return next(new RateLimitError(result.retryAfter));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default rateLimiter;
