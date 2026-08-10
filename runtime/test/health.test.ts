import { describe, expect, it, vi } from 'vitest';
import { makeRuntime } from './helpers.js';

describe('GET /health', () => {
  it('never calls resolveUser', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ domain: 'd1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    );
    const resolveUser = vi.fn(() => 'should-not-be-called');
    const runtime = makeRuntime({ fetchMock, resolveUser });

    await runtime.handle({
      method: 'GET',
      path: '/health',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(resolveUser).not.toHaveBeenCalled();
  });

  it('returns 200 with status/version/capabilities on success', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ domain: 'd1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/health',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    expect(response.kind).toBe('buffered');
    if (response.kind === 'buffered') {
      const parsed = JSON.parse(response.body);
      expect(parsed.status).toBe('ok');
      expect(parsed.capabilities).toEqual({
        chat: true,
        threads: true,
        agents: true,
        files: true,
        memory: true,
        mcpOAuth: true,
      });
    }
  });

  it('returns 503 with a sanitized body when whoami() fails', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: false, message: 'down', code: 'UPSTREAM_DOWN' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
    );
    const runtime = makeRuntime({ fetchMock, mode: 'production' });

    const response = await runtime.handle({
      method: 'GET',
      path: '/health',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(503);
  });
});
