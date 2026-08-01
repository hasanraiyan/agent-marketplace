/**
 * Base error for any non-2xx or `{success:false}` response from the
 * Developer Platform API. Mirrors the backend's own error envelope
 * (`errorFormatter.js`): `{success:false, status, statusCode, message,
 * code, timestamp}`.
 */
export class PersonaApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly response: unknown;

  constructor(message: string, statusCode: number, code: string, response?: unknown) {
    super(message);
    this.name = 'PersonaApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.response = response;
    Object.setPrototypeOf(this, PersonaApiError.prototype);
  }
}

/** 401/403 — invalid/missing credential, or the Project isn't ACTIVE. */
export class PersonaAuthError extends PersonaApiError {
  constructor(message: string, statusCode: number, code: string, response?: unknown) {
    super(message, statusCode, code, response);
    this.name = 'PersonaAuthError';
    Object.setPrototypeOf(this, PersonaAuthError.prototype);
  }
}

/** 400 — request validation failed. */
export class PersonaValidationError extends PersonaApiError {
  constructor(message: string, statusCode: number, code: string, response?: unknown) {
    super(message, statusCode, code, response);
    this.name = 'PersonaValidationError';
    Object.setPrototypeOf(this, PersonaValidationError.prototype);
  }
}

export function errorFromResponse(
  statusCode: number,
  body: { message?: string; code?: string } | undefined
): PersonaApiError {
  const message = body?.message ?? `Request failed with status ${statusCode}`;
  const code = body?.code ?? 'UNKNOWN_ERROR';

  if (statusCode === 401 || statusCode === 403) {
    return new PersonaAuthError(message, statusCode, code, body);
  }
  if (statusCode === 400) {
    return new PersonaValidationError(message, statusCode, code, body);
  }
  return new PersonaApiError(message, statusCode, code, body);
}
