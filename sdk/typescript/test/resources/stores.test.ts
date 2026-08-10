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

describe('StoresResource', () => {
  it('create() POSTs to /api/v1/developer/stores', async () => {
    const store = {
      _id: 's1',
      domain: 'proj-1',
      name: 'notes',
      description: '',
      scope: 'domain',
      accessMode: 'readwrite',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: store }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.stores.create({ name: 'notes', scope: 'domain' });

    expect(result).toEqual(store);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/stores');
    expect(init.method).toBe('POST');
  });

  it('list() GETs with query params and returns a pagination envelope', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { items: [{ _id: 's1' }], pagination: { total: 1, page: 1, limit: 20, pages: 1 } },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.stores.list({ search: 'notes' });

    expect(result.items).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/stores?search=notes');
  });

  it('update() PATCHes and never sends scope (not part of UpdateStoreInput)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 's1', accessMode: 'readonly' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.stores.update('s1', { accessMode: 'readonly' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/stores/s1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ accessMode: 'readonly' });
  });

  it('delete() DELETEs the store', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, message: 'Store deleted successfully' })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.stores.delete('s1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/stores/s1');
    expect(init.method).toBe('DELETE');
  });

  it('listFiles() unwraps { files } into a bare array', async () => {
    const files = [{ path: '/a.md', content: 'hi', mimeType: 'text/markdown' }];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { files } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.stores.listFiles('s1');

    expect(result).toEqual(files);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/stores/s1/files');
  });

  it('getFile()/writeFile()/deleteFile() hit the right sub-paths', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { path: '/a.md', content: 'hi' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.stores.getFile('s1', { path: '/a.md' });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      'https://api.example.com/api/v1/developer/stores/s1/file?path=%2Fa.md'
    );

    await client.stores.writeFile('s1', { path: '/a.md', content: 'hi' });
    const [writeUrl, writeInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(writeUrl).toBe('https://api.example.com/api/v1/developer/stores/s1/file');
    expect(writeInit.method).toBe('PUT');
    expect(JSON.parse(writeInit.body as string)).toEqual({ path: '/a.md', content: 'hi' });

    await client.stores.deleteFile('s1', { path: '/a.md' });
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(deleteUrl).toBe('https://api.example.com/api/v1/developer/stores/s1/file?path=%2Fa.md');
    expect(deleteInit.method).toBe('DELETE');
  });

  it('an externalUser-scoped Store\'s file routes carry x-persona-external-user-id when the client was constructed with it', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { path: '/a.md', content: 'founder data' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik');

    await client.stores.getFile('s2', { path: '/a.md' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-persona-external-user-id']).toBe('sabik');
  });
});
