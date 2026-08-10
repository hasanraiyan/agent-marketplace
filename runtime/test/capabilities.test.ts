import { describe, expect, it, vi } from 'vitest';
import { createRuntime, type RuntimeCapabilities } from '../src/index.js';
import { jsonResponse } from './helpers.js';

function runtimeWith(capabilities?: RuntimeCapabilities) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
  const runtime = createRuntime({
    baseUrl: 'https://api.example.com',
    credential: 'key.secret',
    fetch: fetchMock as unknown as typeof fetch,
    resolveUser: () => 'user-1',
    capabilities,
  });
  return { runtime, fetchMock };
}

const gatedRoutes: Array<{
  capability: keyof RuntimeCapabilities;
  method: 'GET' | 'POST';
  path: string;
  /** Status when disabled — 405 for /agents specifically, since GET /agents is always-on so the path itself exists (just not for POST); every other gated resource has no always-on route sharing its path, so it's a clean 404. */
  disabledStatus: number;
}> = [
  { capability: 'agentsWrite', method: 'POST', path: '/agents', disabledStatus: 405 },
  { capability: 'mcps', method: 'GET', path: '/mcps', disabledStatus: 404 },
  { capability: 'providers', method: 'GET', path: '/providers', disabledStatus: 404 },
  { capability: 'skills', method: 'GET', path: '/skills', disabledStatus: 404 },
  { capability: 'knowledge', method: 'GET', path: '/knowledge', disabledStatus: 404 },
  { capability: 'stores', method: 'GET', path: '/stores', disabledStatus: 404 },
  { capability: 'auditLogs', method: 'GET', path: '/audit-logs', disabledStatus: 404 },
  { capability: 'architect', method: 'POST', path: '/architect', disabledStatus: 404 },
];

describe('capability gating — every admin-surface route is off by default', () => {
  it.each(gatedRoutes)(
    '$method $path is unreachable with no capabilities configured at all',
    async ({ method, path, disabledStatus }) => {
      const { runtime, fetchMock } = runtimeWith(undefined);

      const response = await runtime.handle({
        method,
        path,
        headers: {},
        query: {},
        body: method === 'POST' ? {} : undefined,
        userId: null,
      });

      expect(response.status).toBe(disabledStatus);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it.each(gatedRoutes)(
    '$method $path is unreachable when every OTHER capability is on but this one is off',
    async ({ capability, method, path, disabledStatus }) => {
      const allOthersOn = Object.fromEntries(
        gatedRoutes.map((r) => [r.capability, r.capability !== capability])
      ) as RuntimeCapabilities;
      const { runtime, fetchMock } = runtimeWith(allOthersOn);

      const response = await runtime.handle({
        method,
        path,
        headers: {},
        query: {},
        body: method === 'POST' ? {} : undefined,
        userId: null,
      });

      expect(response.status).toBe(disabledStatus);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it.each(gatedRoutes)(
    '$method $path becomes reachable once its own capability is explicitly enabled',
    async ({ capability, method, path }) => {
      const { runtime, fetchMock } = runtimeWith({ [capability]: true } as RuntimeCapabilities);

      const response = await runtime.handle({
        method,
        path,
        headers: {},
        query: {},
        body:
          method === 'POST'
            ? path === '/agents'
              ? { name: 'x', systemPrompt: 'x', providerId: 'p1' }
              : { messages: [] }
            : undefined,
        userId: null,
      });

      // Not 404 — it actually reached the SDK call (proven by fetchMock firing),
      // regardless of what that call returned.
      expect(response.status).not.toBe(404);
      expect(fetchMock).toHaveBeenCalled();
    }
  );

  it('the always-on surface (chat, threads, files, memory, agents-list, mcp-oauth) needs no capabilities at all', async () => {
    const { runtime, fetchMock } = runtimeWith(undefined);

    const response = await runtime.handle({
      method: 'GET',
      path: '/agents',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).not.toBe(404);
    expect(fetchMock).toHaveBeenCalled();
  });
});
