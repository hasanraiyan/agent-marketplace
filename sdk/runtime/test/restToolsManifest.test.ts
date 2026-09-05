import { describe, expect, it, vi } from 'vitest';
import { makeRuntime } from './helpers.js';

const tool = { name: 'Get profile', method: 'GET' as const, url: 'https://x.example.com/me' };

describe('GET /rest-tools/manifest', () => {
  it('404s when no restToolsManifest is configured', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rest-tools/manifest',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(404);
  });

  it('returns the configured tools when no authToken is set', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const resolveUser = vi.fn(() => 'should-not-be-called');
    const runtime = makeRuntime({
      fetchMock,
      resolveUser,
      restToolsManifest: { tools: [tool] },
    });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rest-tools/manifest',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(resolveUser).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.kind).toBe('buffered');
    if (response.kind === 'buffered') {
      expect(JSON.parse(response.body)).toEqual({ tools: [tool] });
    }
  });

  it('401s when authToken is set and the request has no Authorization header', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const runtime = makeRuntime({
      fetchMock,
      restToolsManifest: { tools: [tool], authToken: 'secret123' },
    });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rest-tools/manifest',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(401);
  });

  it('401s when authToken is set and the Authorization header does not match', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const runtime = makeRuntime({
      fetchMock,
      restToolsManifest: { tools: [tool], authToken: 'secret123' },
    });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rest-tools/manifest',
      headers: { authorization: 'Bearer wrong' },
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(401);
  });

  it('returns 200 when the Authorization header matches authToken', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const runtime = makeRuntime({
      fetchMock,
      restToolsManifest: { tools: [tool], authToken: 'secret123' },
    });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rest-tools/manifest',
      headers: { authorization: 'Bearer secret123' },
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    if (response.kind === 'buffered') {
      expect(JSON.parse(response.body)).toEqual({ tools: [tool] });
    }
  });
});
