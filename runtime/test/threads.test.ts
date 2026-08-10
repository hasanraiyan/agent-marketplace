import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, jsonErrorResponse, makeRuntime } from './helpers.js';

describe('threads routes', () => {
  it('GET /threads proxies to threads.list with coerced page/limit', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [], pagination: {} })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/threads',
      headers: {},
      query: { page: '2', limit: '10' },
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v1/developer/threads');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });

  it('POST /threads requires agentId, creates a thread, and fires onThreadCreate', async () => {
    const onThreadCreate = vi.fn();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ _id: 't1', agentId: 'a1' }, 201)
    );
    const runtime = makeRuntime({ fetchMock, hooks: { onThreadCreate } });

    const response = await runtime.handle({
      method: 'POST',
      path: '/threads',
      headers: {},
      query: {},
      body: { agentId: 'a1' },
      userId: null,
    });

    expect(response.status).toBe(201);
    expect(onThreadCreate).toHaveBeenCalledWith({
      userId: 'user-1',
      agentId: 'a1',
      threadId: 't1',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ agentId: 'a1' });
  });

  it('POST /threads without agentId returns 400 without calling the API', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/threads',
      headers: {},
      query: {},
      body: {},
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /threads/:id proxies to threads.get', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ _id: 't1' })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/threads/t1',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v1/developer/threads/t1');
  });

  it('DELETE /threads/:id returns 204 with an empty body', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/threads/t1',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(204);
    expect(response.kind).toBe('buffered');
    if (response.kind === 'buffered') expect(response.body).toBe('');
  });

  it('sanitizes a backend error passthrough', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonErrorResponse(404, 'Thread not found', 'THREAD_NOT_FOUND')
    );
    const runtime = makeRuntime({ fetchMock, mode: 'production' });

    const response = await runtime.handle({
      method: 'GET',
      path: '/threads/missing',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(404);
    expect(response.kind).toBe('buffered');
    if (response.kind === 'buffered') {
      const parsed = JSON.parse(response.body);
      expect(parsed.error.code).toBe('THREAD_NOT_FOUND');
      expect(parsed.error.message).toBe('Thread not found');
      expect(parsed.error.detail).toBeUndefined();
    }
  });
});
