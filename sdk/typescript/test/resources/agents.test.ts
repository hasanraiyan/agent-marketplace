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

describe('AgentsResource', () => {
  it('create() POSTs to /api/v1/developer/agents with the input body', async () => {
    const agent = {
      _id: 'a1',
      domain: 'proj-1',
      ownerType: 'Project',
      name: 'Career Launchpad',
      slug: 'career-launchpad',
      systemPrompt: 'You help students.',
      providerId: 'p1',
      webSearchEnabled: false,
      visibility: 'private',
      category: 'other',
      isActive: true,
      isMainAgent: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: agent }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.agents.create({
      name: 'Career Launchpad',
      systemPrompt: 'You help students.',
      providerId: 'p1',
    });

    expect(result).toEqual(agent);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/agents');
    expect(init.method).toBe('POST');
  });

  it('create() sends an Idempotency-Key header when provided, omits it otherwise', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 'a1' } }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.agents.create(
      { name: 'X', systemPrompt: 'Y', providerId: 'p1' },
      'idem-key-1'
    );
    const [, initWithKey] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((initWithKey.headers as Record<string, string>)['Idempotency-Key']).toBe('idem-key-1');

    await client.agents.create({ name: 'X', systemPrompt: 'Y', providerId: 'p1' });
    const [, initWithoutKey] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((initWithoutKey.headers as Record<string, string>)['Idempotency-Key']).toBeUndefined();
  });

  it('list() returns a pagination envelope and forwards discovery params', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { items: [{ _id: 'a1' }], pagination: { total: 1, page: 1, limit: 20, pages: 1 } },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    const result = await client.agents.list({ page: 1, category: 'coding', scope: 'mine' });
    expect(result).toEqual({
      items: [{ _id: 'a1' }],
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.example.com/api/v1/developer/agents?page=1&category=coding&scope=mine'
    );
    expect((init.headers as Record<string, string>)['x-persona-external-user-id']).toBe('sabik-42');
  });

  it('get() fetches a single Agent by id', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 'a1', name: 'x' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.agents.get('a1');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/agents/a1');
  });

  it('update() PATCHes the Agent', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 'a1', visibility: 'public' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.agents.update('a1', { visibility: 'public' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/agents/a1');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ visibility: 'public' }));
  });

  it('update() round-trips interruptOn in the request body', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 'a1', interruptOn: { propose_issue: true } } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.agents.update('a1', { interruptOn: { propose_issue: true } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ interruptOn: { propose_issue: true } }));
  });

  it('delete() DELETEs the Agent', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, message: 'Agent deleted successfully' })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.agents.delete('a1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/agents/a1');
    expect(init.method).toBe('DELETE');
  });

  it('bulkDelete() POSTs { ids } to the bulk-delete sub-route and returns { deleted, failed }', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { deleted: ['a1'], failed: [{ id: 'a2', reason: 'Agent not found' }] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.agents.bulkDelete(['a1', 'a2']);
    expect(result).toEqual({ deleted: ['a1'], failed: [{ id: 'a2', reason: 'Agent not found' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/agents/bulk-delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ ids: ['a1', 'a2'] });
  });

  it('getMcpConnections() GETs the mcp-connections sub-route and returns the array', async () => {
    const connections = [
      { mcpId: 'm1', name: 'Pocketly', description: '', connected: false, authorizeUrl: 'https://x/authorize' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: connections })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'user-1');

    const result = await client.agents.getMcpConnections('a1');
    expect(result).toEqual(connections);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/agents/a1/mcp-connections');
    expect((init.headers as Record<string, string>)['x-persona-external-user-id']).toBe('user-1');
  });

  it('getMcpConnections() forwards returnTo as a query param when given, omits it otherwise', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [] })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.agents.getMcpConnections('a1', 'https://app.example.com/copilot');
    const [urlWithReturnTo] = fetchMock.mock.calls[0] as [string];
    expect(urlWithReturnTo).toBe(
      'https://api.example.com/api/v1/developer/agents/a1/mcp-connections?returnTo=https%3A%2F%2Fapp.example.com%2Fcopilot'
    );

    await client.agents.getMcpConnections('a1');
    const [urlWithoutReturnTo] = fetchMock.mock.calls[1] as [string];
    expect(urlWithoutReturnTo).toBe(
      'https://api.example.com/api/v1/developer/agents/a1/mcp-connections'
    );
  });
});
