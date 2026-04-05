import InMemoryRateLimitStore from '../repositories/rateLimiter.repository.js';

/**
 * RateLimiterService - Core rate limiting logic
 *
 * Single Responsibility: Only handles rate limit checks
 * Dependency Inversion: Depends on store abstraction, not concrete implementation
 * Open/Closed: New strategies can be added without modifying this class
 */
class RateLimiterService {
  #store;

  constructor(store = new InMemoryRateLimitStore()) {
    this.#store = store;
  }

  /**
   * Check if a request should be rate limited
   * @param {string} key - Unique identifier (e.g. "rl:/login:192.168.1.1")
   * @param {number} maxRequests - Max requests allowed in the window
   * @param {number} windowMs - Time window in milliseconds
   * @returns {{ allowed: boolean, count: number, remaining: number, retryAfter: number }}
   */
  async check(key, maxRequests, windowMs) {
    const entry = await this.#store.increment(key, windowMs);
    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfter = Math.ceil((entry.resetTime - Date.now()) / 1000);

    return {
      allowed: entry.count <= maxRequests,
      count: entry.count,
      remaining,
      retryAfter,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key) {
    await this.#store.delete(key);
  }

  /**
   * Build a unique key from endpoint and client identifier
   */
  buildKey(endpoint, ip) {
    return `rl:${endpoint}:${ip}`;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (typeof this.#store.destroy === 'function') {
      this.#store.destroy();
    }
  }
}

const rateLimiterService = new RateLimiterService();

export { RateLimiterService };
export default rateLimiterService;
