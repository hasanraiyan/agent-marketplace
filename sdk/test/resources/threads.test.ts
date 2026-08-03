import { describe, expect, it, vi } from 'vitest';
import { PersonaClient } from '../../src/client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeClient(fetchMock: typeof fetch) {
  return new PersonaClient({
    baseUrl: 'https://api.example.com',
    credential: 'key.secret',
    externalUserId: 'sabik-42',
    fetch: fetchMock,
  });
}

describe('ThreadsResource', () => {
  it('create() POSTs { agentId } and sends x-persona-external-user-id', async () => {
    const thread = {
      _id: 't1',
      domain: 'proj-1',
      agentId: 'a1',
      subjectType: 'ExternalUser',
      externalUserId: 'sabik-42',
      threadId: 'uuid-1',
      title: 'New Conversation',
      lastMessageAt: '2026-01-01T00:00:00.000Z',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: thread }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.threads.create({ agentId: 'a1' });
    expect(result).toEqual(thread);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/threads');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-persona-external-user-id']).toBe('sabik-42');
  });

  it('list() returns a bare array with populated agentId objects', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: [{ _id: 't1', agentId: { _id: 'a1', name: 'Career Launchpad', slug: 'cl' } }],
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.threads.list({ page: 1 });
    expect(result[0]?.agentId).toEqual({ _id: 'a1', name: 'Career Launchpad', slug: 'cl' });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/threads?page=1');
  });

  it('get()/updateTitle()/delete() hit the right sub-paths', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 't1' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.threads.get('t1');
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      'https://api.example.com/api/v1/developer/threads/t1'
    );

    await client.threads.updateTitle('t1', 'New title');
    const [updateUrl, updateInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(updateUrl).toBe('https://api.example.com/api/v1/developer/threads/t1');
    expect(updateInit.method).toBe('PATCH');
    expect(updateInit.body).toBe(JSON.stringify({ title: 'New title' }));

    await client.threads.delete('t1');
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(deleteUrl).toBe('https://api.example.com/api/v1/developer/threads/t1');
    expect(deleteInit.method).toBe('DELETE');
  });

  it('update() sends isArchived without requiring a title', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 't1', isArchived: true } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.threads.update('t1', { isArchived: true });
    expect(result.isArchived).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/threads/t1');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ isArchived: true }));
  });

  it('getMessages() returns { messages, state, subagentTraces }', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { messages: [{ role: 'user', content: 'hi' }], state: {}, subagentTraces: {} },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.threads.getMessages('t1');
    expect(result.messages).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/threads/t1/messages');
  });

  it('bulkDelete() POSTs { ids } to the bulk-delete sub-route and returns { deleted, failed }', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { deleted: ['t1'], failed: [{ id: 't2', reason: 'Thread not found' }] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.threads.bulkDelete(['t1', 't2']);
    expect(result).toEqual({ deleted: ['t1'], failed: [{ id: 't2', reason: 'Thread not found' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/threads/bulk-delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ ids: ['t1', 't2'] });
  });
});
