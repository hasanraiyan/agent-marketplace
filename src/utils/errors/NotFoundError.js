import BaseError from './BaseError.js';

/**
 * NotFoundError - Thrown when a resource cannot be found
 */
class NotFoundError extends BaseError {
  constructor(message, resource = null) {
    super(message, 404, 'NOT_FOUND');
    this.resource = resource;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.resource && { resource: this.resource }),
    };
  }
}

export default NotFoundError;
