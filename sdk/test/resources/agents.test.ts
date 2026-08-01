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

  it('list() returns a bare array and forwards discovery params', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [{ _id: 'a1' }] })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    const result = await client.agents.list({ page: 1, category: 'coding', scope: 'mine' });
    expect(result).toEqual([{ _id: 'a1' }]);
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
});
