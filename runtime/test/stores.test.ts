import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

function withCapability(overrides: Parameters<typeof makeRuntime>[0]) {
  return makeRuntime({ ...overrides, capabilities: { stores: true } });
}

describe('stores routes (capabilities.stores)', () => {
  it('POST /stores creates a store', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ _id: 'st1' }, 201)
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/stores',
      headers: {},
      query: {},
      body: { name: 'shared', scope: 'domain' },
      userId: null,
    });

    expect(response.status).toBe(201);
  });

  it('POST /stores without required fields returns 400', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/stores',
      headers: {},
      query: {},
      body: { name: 'shared' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /stores/:id/files proxies to listFiles', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([]));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/stores/st1/files',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
  });

  it('PUT /stores/:id/file writes a file', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ path: '/a.md', content: 'hi', mimeType: 'text/markdown' })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'PUT',
      path: '/stores/st1/file',
      headers: {},
      query: {},
      body: { path: '/a.md', content: 'hi' },
      userId: null,
    });

    expect(response.status).toBe(200);
  });

  it('GET /stores/:id/file requires a path query param', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/stores/st1/file',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DELETE /stores/:id/file returns 204', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/stores/st1/file',
      headers: {},
      query: { path: '/a.md' },
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(204);
  });
});
