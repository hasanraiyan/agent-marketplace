import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

function withCapability(overrides: Parameters<typeof makeRuntime>[0]) {
  return makeRuntime({ ...overrides, capabilities: { providers: true } });
}

describe('providers routes (capabilities.providers)', () => {
  it('POST /providers creates a provider', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ id: 'p1' }, 201)
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/providers',
      headers: {},
      query: {},
      body: {
        label: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-x',
        defaultModel: 'gpt-4o',
      },
      userId: null,
    });

    expect(response.status).toBe(201);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // The API never echoes the key back, but confirm the runtime forwarded it — not silently dropped.
    expect(JSON.parse(init.body as string).apiKey).toBe('sk-x');
  });

  it('POST /providers without required fields returns 400', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/providers',
      headers: {},
      query: {},
      body: { label: 'OpenAI' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /providers/:id/test proxies to testConnection', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, message: 'ok' })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/providers/p1/test',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
  });

  it('GET /providers/:id/models proxies to getModels', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse([{ id: 'gpt-4o' }])
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/providers/p1/models',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
  });

  it('DELETE /providers/:id returns 204', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/providers/p1',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(204);
  });
});
