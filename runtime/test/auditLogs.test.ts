import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

describe('audit logs route (capabilities.auditLogs)', () => {
  it('GET /audit-logs forwards page/limit/eventType', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [], pagination: {} })
    );
    const runtime = makeRuntime({ fetchMock, capabilities: { auditLogs: true } });

    const response = await runtime.handle({
      method: 'GET',
      path: '/audit-logs',
      headers: {},
      query: { page: '1', limit: '10', eventType: 'credential.created' },
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('eventType=credential.created');
  });
});
