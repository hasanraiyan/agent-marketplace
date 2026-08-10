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
