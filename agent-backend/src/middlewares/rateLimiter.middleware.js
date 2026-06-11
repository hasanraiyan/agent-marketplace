import rateLimiterService from '../services/rateLimiter.service.js';
import RateLimitError from '../utils/errors/RateLimitError.js';

/**
 * Rate limit presets for core endpoints
 */
export const RATE_LIMITS = {
  CHAT: { maxRequests: 20, windowMs: 60 * 1000 },
  MUTATE: { maxRequests: 30, windowMs: 60 * 1000 },
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
      // Use userId if available (from authMiddleware), fall back to IP
      const identifier = req.user?._id?.toString() || req.ip || req.socket.remoteAddress;
      const key = rateLimiterService.buildKey(endpoint, identifier);
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
