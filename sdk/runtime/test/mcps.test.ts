import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

function withCapability(overrides: Parameters<typeof makeRuntime>[0]) {
  return makeRuntime({ ...overrides, capabilities: { mcps: true } });
}

describe('mcps write/admin routes (capabilities.mcps)', () => {
  it('POST /mcps creates an MCP server', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ _id: 'm1' }, 201)
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/mcps',
      headers: {},
      query: {},
      body: { name: 'tools', transport: 'http', url: 'https://mcp.example.com' },
      userId: null,
    });

    expect(response.status).toBe(201);
  });

  it('POST /mcps without required fields returns 400', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/mcps',
      headers: {},
      query: {},
      body: { name: 'tools' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /mcps/:id/usage proxies to mcps.getUsage', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ agentCount: 0, agents: [] })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/mcps/m1/usage',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/mcps/m1/usage');
  });

  it('POST /mcps/:id/test proxies to mcps.testConnection', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ tools: [], resources: [], resourceTemplates: [] })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/mcps/m1/test',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
  });

  it('GET /mcps/:id/resource forwards uri query param', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ contents: [] })
    );
    const runtime = withCapability({ fetchMock });

    await runtime.handle({
      method: 'GET',
      path: '/mcps/m1/resource',
      headers: {},
      query: { uri: 'mcp://thing/1' },
      body: undefined,
      userId: null,
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('uri=');
  });

  it('POST /mcps/:id/call-tool forwards name and arguments', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ result: 'ok' })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/mcps/m1/call-tool',
      headers: {},
      query: {},
      body: { name: 'search', arguments: { q: 'x' } },
      userId: null,
    });

    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ name: 'search', arguments: { q: 'x' } });
  });

  it('DELETE /mcps/:id returns 204', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/mcps/m1',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(204);
  });
});
