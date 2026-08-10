import { PersonaApiError } from '@personaai/sdk';
import type { RuntimeBufferedResponse } from './types/response.js';

/** A runtime-originated HTTP error (routing, validation, auth) — as opposed to one surfaced from the Persona API itself. */
export class RuntimeHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'RuntimeHttpError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, RuntimeHttpError.prototype);
  }
}

interface MappedError {
  status: number;
  code: string;
  message: string;
  detail?: unknown;
}

/**
 * Two-tier trust model: errors this runtime (or the Persona API) already
 * curated into a developer-facing message are safe to pass through as-is.
 * Anything else (a bug in host hook code, a raw network error, ...) is
 * untrusted and gets a fixed generic message in production — this is what
 * actually prevents internal implementation details ("LangGraph",
 * "Qdrant", stack traces) from ever reaching a runtime caller.
 */
export function mapErrorToRuntimeError(
  err: unknown,
  mode: 'development' | 'production'
): MappedError {
  const dev = mode === 'development';

  if (err instanceof RuntimeHttpError) {
    return { status: err.status, code: err.code, message: err.message };
  }

  if (err instanceof PersonaApiError) {
    return {
      status: err.statusCode,
      code: err.code,
      message: err.message,
      ...(dev ? { detail: err.response } : {}),
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: dev ? message : 'An internal error occurred.',
    ...(dev
      ? {
          detail: {
            name: err instanceof Error ? err.name : typeof err,
            stack: err instanceof Error ? err.stack : undefined,
          },
        }
      : {}),
  };
}

export function errorToResponse(
  err: unknown,
  mode: 'development' | 'production'
): RuntimeBufferedResponse {
  const mapped = mapErrorToRuntimeError(err, mode);
  return {
    kind: 'buffered',
    status: mapped.status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.detail !== undefined ? { detail: mapped.detail } : {}),
      },
    }),
  };
}
