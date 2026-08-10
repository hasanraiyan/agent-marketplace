import { describe, expect, it, vi } from 'vitest';
import { PersonaClient } from '../../src/client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeClient(fetchMock: typeof fetch, externalUserId?: string) {
  return new PersonaClient({
    baseUrl: 'https://api.example.com',
    credential: 'key.secret',
    externalUserId,
    fetch: fetchMock,
  });
}

describe('AuditLogsResource', () => {
  it('list() returns a pagination envelope and forwards query params', async () => {
    const entry = {
      eventType: 'credential.created',
      timestamp: '2026-01-01T00:00:00.000Z',
      actorContextType: 'ProjectAdmin',
      actorIdentity: 'user_1',
      targetDomain: 'project-1',
      targetResourceId: 'cred_1',
      metadata: {},
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { items: [entry], pagination: { total: 1, page: 1, limit: 20, pages: 1 } },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.auditLogs.list({ eventType: 'credential.created' });
    expect(result).toEqual({
      items: [entry],
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.example.com/api/v1/developer/audit-logs?eventType=credential.created'
    );
    expect(init.method).toBe('GET');
  });

  it('list() returns an empty envelope for a ProjectRuntimeContext client, per the server-side existence-hiding precedent', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { items: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    const result = await client.auditLogs.list();
    expect(result).toEqual({
      items: [],
      pagination: { total: 0, page: 1, limit: 20, pages: 0 },
    });
  });
});
