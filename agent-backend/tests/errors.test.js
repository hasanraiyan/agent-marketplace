import {
  BaseError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from '../src/utils/errors/index.js';

describe('BaseError', () => {
  test('should use default statusCode and code', () => {
    const err = new BaseError('Something failed');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BaseError);
    expect(err.message).toBe('Something failed');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.name).toBe('BaseError');
  });

  test('should accept custom statusCode and code', () => {
    const err = new BaseError('Unauthorized', 401, 'UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('should have a stack trace', () => {
    const err = new BaseError('test');
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe('string');
  });

  test('toJSON with custom values', () => {
    const err = new BaseError('Fail', 503, 'SERVICE_DOWN');
    const json = err.toJSON();
    expect(json).toEqual({
      error: 'BaseError',
      message: 'Fail',
      code: 'SERVICE_DOWN',
      statusCode: 503,
    });
  });

  test('toJSON with defaults', () => {
    const err = new BaseError('Default error');
    const json = err.toJSON();
    expect(json).toEqual({
      error: 'BaseError',
      message: 'Default error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    });
  });
});

describe('NotFoundError', () => {
  test('should set statusCode 404 and code NOT_FOUND', () => {
    const err = new NotFoundError('User not found');
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('NotFoundError');
    expect(err.message).toBe('User not found');
  });

  test('should store resource when provided', () => {
    const err = new NotFoundError('Not found', { type: 'user', id: '123' });
    expect(err.resource).toEqual({ type: 'user', id: '123' });
  });

  test('resource should be null by default', () => {
    const err = new NotFoundError('Not found');
    expect(err.resource).toBeNull();
  });

  test('toJSON should include resource when provided', () => {
    const err = new NotFoundError('Not found', 'User');
    const json = err.toJSON();
    expect(json).toEqual({
      error: 'NotFoundError',
      message: 'Not found',
      code: 'NOT_FOUND',
      statusCode: 404,
      resource: 'User',
    });
  });

  test('toJSON should omit resource when not provided', () => {
    const err = new NotFoundError('Not found');
    const json = err.toJSON();
    expect(json).toEqual({
      error: 'NotFoundError',
      message: 'Not found',
      code: 'NOT_FOUND',
      statusCode: 404,
    });
    expect(json).not.toHaveProperty('resource');
  });

  test('toJSON should omit resource when null', () => {
    const err = new NotFoundError('Not found', null);
    const json = err.toJSON();
    expect(json).not.toHaveProperty('resource');
  });

  test('should have a stack trace', () => {
    const err = new NotFoundError('Missing');
    expect(err.stack).toBeDefined();
  });
});

describe('RateLimitError', () => {
  test('should set statusCode 429 and code RATE_LIMITED', () => {
    const err = new RateLimitError(60);
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.name).toBe('RateLimitError');
  });

  test('should include retryAfter value', () => {
    const err = new RateLimitError(900);
    expect(err.retryAfter).toBe(900);
  });

  test('message should include seconds', () => {
    const err = new RateLimitError(120);
    expect(err.message).toBe('Too many requests. Try again in 120 seconds.');
  });

  test('toJSON should include retryAfter', () => {
    const err = new RateLimitError(300);
    const json = err.toJSON();
    expect(json).toEqual({
      error: 'RateLimitError',
      message: 'Too many requests. Try again in 300 seconds.',
      code: 'RATE_LIMITED',
      statusCode: 429,
      retryAfter: 300,
    });
  });

  test('should handle zero retryAfter', () => {
    const err = new RateLimitError(0);
    expect(err.retryAfter).toBe(0);
    expect(err.message).toContain('0 seconds');
    const json = err.toJSON();
    expect(json.retryAfter).toBe(0);
  });

  test('should have a stack trace', () => {
    const err = new RateLimitError(60);
    expect(err.stack).toBeDefined();
  });
});

describe('ValidationError', () => {
  test('should set statusCode 400 and code VALIDATION_ERROR', () => {
    const err = new ValidationError('Invalid input');
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.name).toBe('ValidationError');
    expect(err.message).toBe('Invalid input');
  });

  test('should store details when provided', () => {
    const details = { errors: [{ field: 'email', message: 'invalid' }] };
    const err = new ValidationError('Invalid', details);
    expect(err.details).toEqual(details);
  });

  test('details should be null by default', () => {
    const err = new ValidationError('Invalid');
    expect(err.details).toBeNull();
  });

  test('toJSON should include details when provided', () => {
    const details = [{ field: 'name', message: 'required' }];
    const err = new ValidationError('Validation failed', details);
    const json = err.toJSON();
    expect(json).toEqual({
      error: 'ValidationError',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details,
    });
  });

  test('toJSON should omit details when null', () => {
    const err = new ValidationError('Bad input');
    const json = err.toJSON();
    expect(json).toEqual({
      error: 'ValidationError',
      message: 'Bad input',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    expect(json).not.toHaveProperty('details');
  });

  test('toJSON should omit details when false', () => {
    const err = new ValidationError('Bad', false);
    const json = err.toJSON();
    expect(json).not.toHaveProperty('details');
  });

  test('toJSON should include details when empty object', () => {
    const err = new ValidationError('Bad', {});
    const json = err.toJSON();
    expect(json).toHaveProperty('details');
  });

  test('should have a stack trace', () => {
    const err = new ValidationError('test');
    expect(err.stack).toBeDefined();
  });
});

describe('Error index re-exports', () => {
  test('should re-export all error classes', async () => {
    const mod = await import('../src/utils/errors/index.js');
    expect(mod.BaseError).toBe(BaseError);
    expect(mod.NotFoundError).toBe(NotFoundError);
    expect(mod.RateLimitError).toBe(RateLimitError);
    expect(mod.ValidationError).toBe(ValidationError);
  });
});
