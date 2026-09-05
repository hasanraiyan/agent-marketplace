import { describe, expect, it, vi } from 'vitest';
import { makeRuntime } from './helpers.js';

const tool = {
  name: 'get_weather',
  description: 'Get current weather.',
  method: 'GET' as const,
  url: 'https://x.example.com/weather',
  params: [],
};

describe('GET /rcp/manifest', () => {
  it('404s when no rcpManifest is configured', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rcp/manifest',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(404);
  });

  it('returns a conformant manifest with auth: none when no authToken is set', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const resolveUser = vi.fn(() => 'should-not-be-called');
    const runtime = makeRuntime({
      fetchMock,
      resolveUser,
      rcpManifest: { tools: [tool] },
    });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rcp/manifest',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(resolveUser).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.kind).toBe('buffered');
    if (response.kind === 'buffered') {
      expect(JSON.parse(response.body)).toEqual({
        rcpVersion: '0.1',
        auth: { type: 'none' },
        tools: [tool],
      });
    }
  });

  it('declares auth: header and 401s when authToken is set and the request has no Authorization header', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const runtime = makeRuntime({
      fetchMock,
      rcpManifest: { tools: [tool], authToken: 'secret123' },
    });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rcp/manifest',
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
      rcpManifest: { tools: [tool], authToken: 'secret123' },
    });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rcp/manifest',
      headers: { authorization: 'Bearer wrong' },
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(401);
  });

  it('returns a manifest declaring auth: header when the Authorization header matches authToken', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const runtime = makeRuntime({
      fetchMock,
      rcpManifest: { tools: [tool], authToken: 'secret123' },
    });

    const response = await runtime.handle({
      method: 'GET',
      path: '/rcp/manifest',
      headers: { authorization: 'Bearer secret123' },
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    if (response.kind === 'buffered') {
      expect(JSON.parse(response.body)).toEqual({
        rcpVersion: '0.1',
        auth: { type: 'header', header: 'Authorization', scheme: 'Bearer' },
        tools: [tool],
      });
    }
  });
});
