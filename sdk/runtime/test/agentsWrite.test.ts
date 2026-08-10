import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

function withCapability(overrides: Parameters<typeof makeRuntime>[0]) {
  return makeRuntime({ ...overrides, capabilities: { agentsWrite: true } });
}

describe('agents write routes (capabilities.agentsWrite)', () => {
  it('POST /agents creates an agent from the minimum required fields', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ _id: 'a1', name: 'x' }, 201)
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/agents',
      headers: {},
      query: {},
      body: { name: 'Helper', systemPrompt: 'Be helpful', providerId: 'p1' },
      userId: null,
    });

    expect(response.status).toBe(201);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      name: 'Helper',
      systemPrompt: 'Be helpful',
      providerId: 'p1',
    });
  });

  it('POST /agents without required fields returns 400', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/agents',
      headers: {},
      query: {},
      body: { name: 'Helper' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /agents/:id proxies to agents.get', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ _id: 'a1' })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/agents/a1',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v1/developer/agents/a1');
  });

  it('PATCH /agents/:id proxies to agents.update', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ _id: 'a1', name: 'renamed' })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'PATCH',
      path: '/agents/a1',
      headers: {},
      query: {},
      body: { name: 'renamed' },
      userId: null,
    });

    expect(response.status).toBe(200);
  });

  it('DELETE /agents/:id returns 204', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/agents/a1',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(204);
  });

  it('POST /agents/bulk-delete proxies to agents.bulkDelete', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ deleted: ['a1'], failed: [] })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/agents/bulk-delete',
      headers: {},
      query: {},
      body: { ids: ['a1'] },
      userId: null,
    });

    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ ids: ['a1'] });
  });
});
