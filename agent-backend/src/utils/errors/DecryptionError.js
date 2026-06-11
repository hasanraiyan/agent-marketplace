import BaseError from './BaseError.js';

/**
 * DecryptionError - Thrown when a token cannot be decrypted
 */
class DecryptionError extends BaseError {
  constructor(message = 'Failed to decrypt token') {
    super(message, 500, 'DECRYPTION_FAILED');
  }
}

export default DecryptionError;
