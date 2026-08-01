import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/http.js';
import { PersonaApiError, PersonaAuthError, PersonaValidationError } from '../src/errors.js';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('HttpClient', () => {
  it('throws when constructed without baseUrl or credential', () => {
    expect(() => new HttpClient({ baseUrl: '', credential: 'x' })).toThrow(/baseUrl/);
    expect(() => new HttpClient({ baseUrl: 'https://api.example.com', credential: '' })).toThrow(
      /credential/
    );
  });

  it('injects the Authorization header from the credential', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { ok: true } })
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key123.secret456',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.request('GET', '/api/v1/developer/whoami');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer key123.secret456');
  });

  it('injects x-persona-external-user-id only when provided', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: {} })
    );
    const withUser = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      externalUserId: 'user-42',
      fetch: fetchMock as unknown as typeof fetch,
    });
    await withUser.request('GET', '/api/v1/developer/whoami');
    let headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers['x-persona-external-user-id']).toBe('user-42');

    fetchMock.mockClear();
    const withoutUser = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });
    await withoutUser.request('GET', '/api/v1/developer/whoami');
    headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers['x-persona-external-user-id']).toBeUndefined();
  });

  it('serializes a plain object body as JSON with a Content-Type header', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { id: '1' } }, 201)
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.request('POST', '/api/v1/developer/agents', { body: { name: 'Bot' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ name: 'Bot' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sends a FormData body as-is, without a Content-Type header', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: {} })
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const form = new FormData();
    form.append('file', new Blob(['hello']), 'hello.txt');
    await client.request('POST', '/api/v1/developer/files', { body: form });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('builds query strings, skipping undefined values', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [] })
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.request('GET', '/api/v1/developer/agents', {
      query: { page: 1, limit: 10, search: undefined, scope: 'mine' },
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/agents?page=1&limit=10&scope=mine');
  });

  it('unwraps the `data` field from a full success envelope', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, statusCode: 200, message: 'ok', data: { id: 'a1' } })
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.request('GET', '/api/v1/developer/agents/a1');
    expect(result).toEqual({ id: 'a1' });
  });

  it('handles the narrower whoami-style envelope ({success, data} only)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { domain: 'd1', principalType: 'ProjectMachine' } })
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.request('GET', '/api/v1/developer/whoami');
    expect(result).toEqual({ domain: 'd1', principalType: 'ProjectMachine' });
  });

  it('throws PersonaAuthError on 401', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(
        {
          success: false,
          status: 'error',
          statusCode: 401,
          message: 'Invalid credential',
          code: 'UNAUTHORIZED',
        },
        401
      )
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'bad.credential',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.request('GET', '/api/v1/developer/whoami')).rejects.toThrow(
      PersonaAuthError
    );
  });

  it('throws PersonaValidationError on 400 and preserves code/message', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(
        {
          success: false,
          status: 'error',
          statusCode: 400,
          message: 'Validation error, or invalid Provider',
          code: 'VALIDATION_ERROR',
        },
        400
      )
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    try {
      await client.request('POST', '/api/v1/developer/agents', { body: {} });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PersonaValidationError);
      const validationErr = err as PersonaValidationError;
      expect(validationErr.code).toBe('VALIDATION_ERROR');
      expect(validationErr.statusCode).toBe(400);
      expect(validationErr.message).toBe('Validation error, or invalid Provider');
    }
  });

  it('throws the base PersonaApiError for other error statuses (e.g. 404)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(
        {
          success: false,
          status: 'error',
          statusCode: 404,
          message: 'Agent not found',
          code: 'NOT_FOUND',
        },
        404
      )
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.request('GET', '/api/v1/developer/agents/x')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('retries once on 429 honoring Retry-After, then succeeds', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      callCount += 1;
      if (callCount === 1) {
        return jsonResponse(
          { success: false, statusCode: 429, message: 'Too many requests', code: 'RATE_LIMITED' },
          429,
          { 'Retry-After': '0' }
        );
      }
      return jsonResponse({ success: true, data: { ok: true } });
    });

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
      maxRetries: 2,
    });

    const result = await client.request('POST', '/api/v1/developer/agui');
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxRetries and throws on a persistent 429', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(
        { success: false, statusCode: 429, message: 'Too many requests', code: 'RATE_LIMITED' },
        429,
        { 'Retry-After': '0' }
      )
    );

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
      maxRetries: 1,
    });

    await expect(client.request('POST', '/api/v1/developer/agui')).rejects.toBeInstanceOf(
      PersonaApiError
    );
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it('throws for a non-JSON error response', async () => {
    const fetchMock = vi.fn(
      async () => new Response('Internal Server Error', { status: 500, headers: {} })
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.request('GET', '/api/v1/developer/whoami')).rejects.toBeInstanceOf(
      PersonaApiError
    );
  });

  it('strips trailing slashes from baseUrl', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: {} })
    );
    const client = new HttpClient({
      baseUrl: 'https://api.example.com/',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.request('GET', '/api/v1/developer/whoami');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/whoami');
  });
});
