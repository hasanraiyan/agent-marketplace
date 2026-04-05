import BaseError from './BaseError.js';

class RateLimitError extends BaseError {
  constructor(retryAfterSeconds) {
    super(`Too many requests. Try again in ${retryAfterSeconds} seconds.`, 429, 'RATE_LIMITED');
    this.retryAfter = retryAfterSeconds;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

export default RateLimitError;
