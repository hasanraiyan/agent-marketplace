import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

describe('auth', () => {
  it('responds 401 when resolveUser returns null', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [] })
    );
    const runtime = makeRuntime({ fetchMock, resolveUser: () => null });

    const response = await runtime.handle({
      method: 'GET',
      path: '/threads',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('responds 401 (not 500) when resolveUser throws', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [] })
    );
    const runtime = makeRuntime({
      fetchMock,
      resolveUser: () => {
        throw new Error('boom');
      },
    });

    const response = await runtime.handle({
      method: 'GET',
      path: '/threads',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(401);
  });

  it('forwards the resolved userId as x-persona-external-user-id', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [], pagination: {} })
    );
    const runtime = makeRuntime({ fetchMock, resolveUser: () => 'user-42' });

    await runtime.handle({
      method: 'GET',
      path: '/threads',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-persona-external-user-id']).toBe('user-42');
  });
});
