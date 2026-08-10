import { describe, expect, it } from 'vitest';
import { PersonaApiError, PersonaAuthError, PersonaValidationError } from '@personaai/sdk';
import { mapErrorToRuntimeError, RuntimeHttpError } from '../src/errors.js';

describe('mapErrorToRuntimeError', () => {
  it('passes RuntimeHttpError through as-is', () => {
    const err = new RuntimeHttpError(404, 'NOT_FOUND', 'nope');
    expect(mapErrorToRuntimeError(err, 'production')).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      message: 'nope',
    });
  });

  it('passes PersonaAuthError through in production, without detail', () => {
    const err = new PersonaAuthError('bad key', 401, 'PROVIDER_AUTH_ERROR', { raw: true });
    const mapped = mapErrorToRuntimeError(err, 'production');
    expect(mapped).toEqual({ status: 401, code: 'PROVIDER_AUTH_ERROR', message: 'bad key' });
  });

  it('includes response detail for a PersonaApiError-family error in development mode', () => {
    const err = new PersonaValidationError('bad input', 400, 'INVALID_REQUEST', { field: 'x' });
    const mapped = mapErrorToRuntimeError(err, 'development');
    expect(mapped.detail).toEqual({ field: 'x' });
  });

  it('base PersonaApiError also passes through', () => {
    const err = new PersonaApiError('rate limited', 429, 'RATE_LIMITED');
    const mapped = mapErrorToRuntimeError(err, 'production');
    expect(mapped).toEqual({ status: 429, code: 'RATE_LIMITED', message: 'rate limited' });
  });

  it('sanitizes an arbitrary Error to a generic 500 in production (no message/stack leak)', () => {
    const err = new Error('Qdrant collection "agent-42" connection refused at 10.0.0.5');
    const mapped = mapErrorToRuntimeError(err, 'production');
    expect(mapped).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred.',
    });
  });

  it('includes name/stack detail for an arbitrary Error in development mode', () => {
    const err = new Error('boom');
    const mapped = mapErrorToRuntimeError(err, 'development');
    expect(mapped.status).toBe(500);
    expect(mapped.message).toBe('boom');
    expect((mapped.detail as { name: string }).name).toBe('Error');
  });

  it('handles a thrown non-Error value', () => {
    const mapped = mapErrorToRuntimeError('just a string', 'production');
    expect(mapped).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred.',
    });
  });
});
