import { RuntimeHttpError } from './errors.js';
import type { RuntimeBufferedResponse } from './types/response.js';

export function json(status: number, value: unknown): RuntimeBufferedResponse {
  return {
    kind: 'buffered',
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  };
}

export function noContent(): RuntimeBufferedResponse {
  return { kind: 'buffered', status: 204, headers: {}, body: '' };
}

export function requireParam(params: Record<string, string>, name: string): string {
  const value = params[name];
  if (!value) {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', `"${name}" path parameter is required.`);
  }
  return value;
}

export function requireQueryParam(query: Record<string, string | undefined>, name: string): string {
  const value = query[name];
  if (!value) {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', `"${name}" query parameter is required.`);
  }
  return value;
}

export function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function requireBodyObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', 'Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function requireStringField(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      `"${field}" is required and must be a string.`
    );
  }
  return value;
}

// TURN_CONTEXT_RCP_RESOLVERS_PLAN.md — mirrors agent-backend's
// agui/turnContext.js#validateTurnContext exactly, so a bad `context` body
// field fails fast here rather than round-tripping to the backend first.
// Distinct from `contextOverride` (a plain string, no shape validation
// beyond length): `context` is never shown to the model, only ever read
// live by an RCP tool's resolver.
const MAX_TURN_CONTEXT_BYTES = 2000;

export function validateTurnContext(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeHttpError(400, 'INVALID_CONTEXT', 'context must be a flat object.');
  }

  const context = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(context)) {
    const entryType = typeof entry;
    if (entryType !== 'string' && entryType !== 'number' && entryType !== 'boolean') {
      throw new RuntimeHttpError(
        400,
        'INVALID_CONTEXT',
        `context.${key} must be a string, number, or boolean.`
      );
    }
  }

  // TextEncoder, not Buffer — this package must stay Edge-runtime
  // compatible (no node:* imports, no Node-only globals).
  const byteLength = new TextEncoder().encode(JSON.stringify(context)).length;
  if (byteLength > MAX_TURN_CONTEXT_BYTES) {
    throw new RuntimeHttpError(
      400,
      'CONTEXT_TOO_LARGE',
      `context must be ${MAX_TURN_CONTEXT_BYTES} bytes or fewer when serialized.`
    );
  }

  return context;
}
