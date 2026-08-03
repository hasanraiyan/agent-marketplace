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

describe('SkillsResource', () => {
  it('create() POSTs to /api/v1/developer/skills', async () => {
    const skill = {
      _id: 's1',
      domain: 'proj-1',
      ownerType: 'Project',
      name: 'greeting-style',
      description: 'Greet warmly',
      instructions: 'Be warm.',
      files: [],
      isPublic: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: skill }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.skills.create({
      name: 'greeting-style',
      description: 'Greet warmly',
      instructions: 'Be warm.',
    });

    expect(result).toEqual(skill);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/skills');
    expect(init.method).toBe('POST');
  });

  it('list() returns a bare array (no pagination envelope) and forwards query params', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [{ _id: 's1' }, { _id: 's2' }] })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    const result = await client.skills.list({ page: 1, limit: 10, scope: 'mine' });
    expect(result).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/skills?page=1&limit=10&scope=mine');
    expect((init.headers as Record<string, string>)['x-persona-external-user-id']).toBe('sabik-42');
  });

  it('get() fetches a single Skill by id', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 's1', name: 'x' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.skills.get('s1');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/skills/s1');
  });

  it('update() PATCHes the Skill', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 's1', isPublic: true } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.skills.update('s1', { isPublic: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/skills/s1');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ isPublic: true }));
  });

  it('delete() DELETEs the Skill', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, message: 'Skill deleted successfully' })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.skills.delete('s1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/skills/s1');
    expect(init.method).toBe('DELETE');
  });

  it('getUsage() GETs the usage sub-route and returns agent count + preview', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const usage = await client.skills.getUsage('s1');
    expect(usage).toEqual({ agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/skills/s1/usage');
    expect(init.method).toBe('GET');
  });

  it('bulkDelete() POSTs { ids } to the bulk-delete sub-route and returns { deleted, failed }', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { deleted: ['s1'], failed: [{ id: 's2', reason: 'Skill not found' }] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.skills.bulkDelete(['s1', 's2']);
    expect(result).toEqual({ deleted: ['s1'], failed: [{ id: 's2', reason: 'Skill not found' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/skills/bulk-delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ ids: ['s1', 's2'] });
  });
});
