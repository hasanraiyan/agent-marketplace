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

describe('McpsResource', () => {
  it('create() POSTs to /api/v1/developer/mcps', async () => {
    const mcp = {
      _id: 'm1',
      domain: 'proj-1',
      ownerType: 'Project',
      name: 'Excalidraw',
      transport: 'http',
      url: 'https://excalidraw.example.com/mcp',
      authType: 'none',
      authMode: 'owner',
      hasApiKey: false,
      isEnabled: true,
      tools: [],
      resources: [],
      resourceTemplates: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: mcp }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.mcps.create({
      name: 'Excalidraw',
      transport: 'http',
      url: 'https://excalidraw.example.com/mcp',
    });

    expect(result).toEqual(mcp);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/mcps');
    expect(init.method).toBe('POST');
  });

  it('list() returns a bare array and forwards query params', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [{ _id: 'm1' }] })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    const result = await client.mcps.list({ scope: 'mine' });
    expect(result).toEqual([{ _id: 'm1' }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/mcps?scope=mine');
  });

  it('get()/update()/delete() hit the right sub-paths', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 'm1' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.mcps.get('m1');
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      'https://api.example.com/api/v1/developer/mcps/m1'
    );

    await client.mcps.update('m1', { isEnabled: false });
    const [updateUrl, updateInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(updateUrl).toBe('https://api.example.com/api/v1/developer/mcps/m1');
    expect(updateInit.method).toBe('PATCH');

    await client.mcps.delete('m1');
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(deleteUrl).toBe('https://api.example.com/api/v1/developer/mcps/m1');
    expect(deleteInit.method).toBe('DELETE');
  });

  it('testConnection() POSTs to the test sub-route', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { tools: [{ name: 't1', description: 'x' }], resources: [], resourceTemplates: [] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.mcps.testConnection('m1');
    expect(result.tools).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/mcps/m1/test');
    expect(init.method).toBe('POST');
  });

  it('readResource() GETs the resource sub-route with a uri query param', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { text: 'hello', mimeType: 'text/html' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.mcps.readResource('m1', 'ui://widget/1');
    expect(result).toEqual({ text: 'hello', mimeType: 'text/html' });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      'https://api.example.com/api/v1/developer/mcps/m1/resource?uri=ui%3A%2F%2Fwidget%2F1'
    );
  });

  it('callTool() POSTs { name, arguments } to the call-tool sub-route', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { content: [{ type: 'text', text: 'ok' }] } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.mcps.callTool('m1', 'search', { query: 'foo' });
    expect(result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/mcps/m1/call-tool');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'search',
      arguments: { query: 'foo' },
    });
  });

  it('getUsage() GETs the usage sub-route and returns agent count + preview', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const usage = await client.mcps.getUsage('m1');
    expect(usage).toEqual({ agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/mcps/m1/usage');
    expect(init.method).toBe('GET');
  });
});

describe('McpOAuthResource', () => {
  it('getOwnerAuthorizeUrl() GETs the owner authorize sub-route', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { url: 'https://oauth.example.com/authorize' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.mcps.oauth.getOwnerAuthorizeUrl('m1');
    expect(result.url).toBe('https://oauth.example.com/authorize');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/mcps/m1/oauth/owner/authorize');
  });

  it('getUserAuthorizeUrl() forwards an optional returnTo param, omitted when unset', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { url: 'https://oauth.example.com/authorize' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    await client.mcps.oauth.getUserAuthorizeUrl('m1', 'https://app.example.com/done');
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      'https://api.example.com/api/v1/developer/mcps/m1/oauth/user/authorize?returnTo=https%3A%2F%2Fapp.example.com%2Fdone'
    );

    fetchMock.mockClear();
    await client.mcps.oauth.getUserAuthorizeUrl('m1');
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      'https://api.example.com/api/v1/developer/mcps/m1/oauth/user/authorize'
    );
  });

  it('getUserConnectionStatus() returns { connected }', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { connected: true } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const status = await client.mcps.oauth.getUserConnectionStatus('m1');
    expect(status).toEqual({ connected: true });
  });

  it('disconnectUserConnection()/disconnectOwnerConnection() DELETE the right sub-paths', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, message: 'Disconnected' })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.mcps.oauth.disconnectUserConnection('m1');
    const [userUrl, userInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(userUrl).toBe('https://api.example.com/api/v1/developer/mcps/m1/oauth/user/connection');
    expect(userInit.method).toBe('DELETE');

    await client.mcps.oauth.disconnectOwnerConnection('m1');
    const [ownerUrl, ownerInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(ownerUrl).toBe(
      'https://api.example.com/api/v1/developer/mcps/m1/oauth/owner/connection'
    );
    expect(ownerInit.method).toBe('DELETE');
  });
});
