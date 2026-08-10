import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

function withCapability(overrides: Parameters<typeof makeRuntime>[0]) {
  return makeRuntime({ ...overrides, capabilities: { skills: true } });
}

describe('skills routes (capabilities.skills)', () => {
  it('POST /skills creates a skill', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ _id: 's1' }, 201)
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/skills',
      headers: {},
      query: {},
      body: { name: 'Search', description: 'Web search', instructions: 'Use the search tool' },
      userId: null,
    });

    expect(response.status).toBe(201);
  });

  it('POST /skills without required fields returns 400', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/skills',
      headers: {},
      query: {},
      body: { name: 'Search' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /skills/:id/usage proxies to getUsage', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ agentCount: 0, agents: [] })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/skills/s1/usage',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
  });

  it('POST /skills/bulk-delete proxies to bulkDelete', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ deleted: ['s1'], failed: [] })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/skills/bulk-delete',
      headers: {},
      query: {},
      body: { ids: ['s1'] },
      userId: null,
    });

    expect(response.status).toBe(200);
  });
});
