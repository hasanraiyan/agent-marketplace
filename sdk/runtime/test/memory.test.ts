import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

describe('memory routes', () => {
  it('GET /memory proxies to memory.list', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ userFiles: [], agentMemories: [] })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/memory',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v1/developer/memory');
  });

  it('GET /memory/file requires a path query param', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/memory/file',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /memory/file forwards path/scope/agentId', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        scope: 'agent',
        agentId: 'a1',
        path: '/x.md',
        content: 'hi',
        mimeType: 'text/markdown',
      })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/memory/file',
      headers: {},
      query: { path: '/memories/agent/x.md', scope: 'agent', agentId: 'a1' },
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('scope=agent');
    expect(url).toContain('agentId=a1');
  });

  it('GET /memory/file rejects scope=agent without agentId', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/memory/file',
      headers: {},
      query: { path: '/memories/agent/x.md', scope: 'agent' },
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PUT /memory/file writes the file and fires onMemoryWrite', async () => {
    const onMemoryWrite = vi.fn();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        scope: 'user',
        path: '/memories/user/prefs.md',
        content: 'hi',
        mimeType: 'text/markdown',
      })
    );
    const runtime = makeRuntime({ fetchMock, hooks: { onMemoryWrite } });

    const response = await runtime.handle({
      method: 'PUT',
      path: '/memory/file',
      headers: {},
      query: {},
      body: { path: '/memories/user/prefs.md', content: 'hi' },
      userId: null,
    });

    expect(response.status).toBe(200);
    expect(onMemoryWrite).toHaveBeenCalledWith({
      userId: 'user-1',
      agentId: undefined,
      path: '/memories/user/prefs.md',
    });
  });

  it('PUT /memory/file without content returns 400', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'PUT',
      path: '/memory/file',
      headers: {},
      query: {},
      body: { path: '/x.md' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DELETE /memory/file returns 204', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/memory/file',
      headers: {},
      query: { path: '/memories/user/prefs.md' },
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(204);
  });
});
