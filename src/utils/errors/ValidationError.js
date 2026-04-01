import BaseError from './BaseError.js';

/**
 * ValidationError - Thrown when input validation fails
 * Extends BaseError without modifying it (Open/Closed Principle)
 */
class ValidationError extends BaseError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.details && { details: this.details }),
    };
  }
}

export default ValidationError;
