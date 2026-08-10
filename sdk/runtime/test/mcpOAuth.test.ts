import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

describe('mcp oauth routes', () => {
  it('GET /mcps/:id/oauth/owner/authorize proxies to getOwnerAuthorizeUrl', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ url: 'https://provider/authorize' })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/mcps/mcp1/oauth/owner/authorize',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v1/developer/mcps/mcp1/oauth/owner/authorize');
  });

  it('GET /mcps/:id/oauth/user/authorize forwards returnTo', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ url: 'https://provider/authorize' })
    );
    const runtime = makeRuntime({ fetchMock });

    await runtime.handle({
      method: 'GET',
      path: '/mcps/mcp1/oauth/user/authorize',
      headers: {},
      query: { returnTo: 'https://app.example.com/done' },
      body: undefined,
      userId: null,
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('returnTo=');
  });

  it('GET /mcps/:id/oauth/user/status proxies to getUserConnectionStatus', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ connected: true })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/mcps/mcp1/oauth/user/status',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/oauth/user/status');
  });

  it('DELETE /mcps/:id/oauth/user/connection returns 204', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/mcps/mcp1/oauth/user/connection',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(204);
  });

  it('DELETE /mcps/:id/oauth/owner/connection returns 204', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/mcps/mcp1/oauth/owner/connection',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(204);
  });
});
