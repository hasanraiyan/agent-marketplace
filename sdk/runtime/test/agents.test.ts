import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

describe('GET /agents', () => {
  it('forwards page/limit/search/category/scope query params', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [], pagination: {} })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/agents',
      headers: {},
      query: { page: '3', limit: '5', search: 'sales', category: 'productivity', scope: 'mine' },
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('page=3');
    expect(url).toContain('limit=5');
    expect(url).toContain('search=sales');
    expect(url).toContain('category=productivity');
    expect(url).toContain('scope=mine');
  });

  it('omits scope when not exactly "mine"', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [], pagination: {} })
    );
    const runtime = makeRuntime({ fetchMock });

    await runtime.handle({
      method: 'GET',
      path: '/agents',
      headers: {},
      query: { scope: 'everyone' },
      body: undefined,
      userId: null,
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain('scope=');
  });
});

describe('GET /agents/:id/mcp-connections', () => {
  it('is reachable with no capabilities enabled -- same always-on tier as the MCP OAuth routes, not agentsWrite-gated Agent CRUD', async () => {
    const connections = [
      { mcpId: 'm1', name: 'Pocketly', description: '', connected: false, authorizeUrl: 'https://x/authorize' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(connections));
    const runtime = makeRuntime({ fetchMock }); // no `capabilities` passed — everything gated defaults off

    const response = await runtime.handle({
      method: 'GET',
      path: '/agents/a1/mcp-connections',
      headers: {},
      query: {},
      body: undefined,
      userId: 'user-1',
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/agents/a1/mcp-connections');
  });

  it('forwards returnTo as a query param', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([]));
    const runtime = makeRuntime({ fetchMock });

    await runtime.handle({
      method: 'GET',
      path: '/agents/a1/mcp-connections',
      headers: {},
      query: { returnTo: 'https://app.example.com/copilot' },
      body: undefined,
      userId: 'user-1',
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('returnTo=');
  });
});
