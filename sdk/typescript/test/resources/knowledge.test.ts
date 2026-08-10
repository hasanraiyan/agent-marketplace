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
    fetch: fetchMock,
  });
}

describe('KnowledgeResource', () => {
  it('create() POSTs to /api/v1/developer/knowledge, requiring providerId', async () => {
    const kb = { _id: 'kb1', domain: 'proj-1', ownerType: 'Project', name: 'FAQ' };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: kb }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.knowledge.create({ name: 'FAQ', providerId: 'p1' });
    expect(result).toEqual(kb);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/knowledge');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'FAQ', providerId: 'p1' });
  });

  it('create() sends an Idempotency-Key header when provided', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 'kb1' } }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.knowledge.create({ name: 'FAQ', providerId: 'p1' }, 'idem-key-1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('idem-key-1');
  });

  it('list() returns a pagination envelope and forwards query params', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { items: [{ _id: 'kb1' }], pagination: { total: 1, page: 1, limit: 20, pages: 1 } },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.knowledge.list({ scope: 'mine' });
    expect(result).toEqual({
      items: [{ _id: 'kb1' }],
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
    });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/knowledge?scope=mine');
  });

  it('get()/update()/delete() hit the right sub-paths', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 'kb1' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.knowledge.get('kb1');
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      'https://api.example.com/api/v1/developer/knowledge/kb1'
    );

    await client.knowledge.update('kb1', { isPublic: true });
    const [updateUrl, updateInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(updateUrl).toBe('https://api.example.com/api/v1/developer/knowledge/kb1');
    expect(updateInit.method).toBe('PATCH');

    await client.knowledge.delete('kb1');
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(deleteUrl).toBe('https://api.example.com/api/v1/developer/knowledge/kb1');
    expect(deleteInit.method).toBe('DELETE');
  });

  it('uploadDocuments() sends a multipart FormData body under the "files" field', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: {
          documentCount: 1,
          chunkCount: 3,
          files: [{ fileName: 'notes.txt', fileSize: 12, mimeType: 'text/plain', chunkCount: 3 }],
        },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.knowledge.uploadDocuments('kb1', [
      {
        filename: 'notes.txt',
        content: new TextEncoder().encode('hello world'),
        contentType: 'text/plain',
      },
    ]);

    expect(result.documentCount).toBe(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/knowledge/kb1/documents');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();

    const form = init.body as FormData;
    const file = form.get('files') as File;
    expect(file.name).toBe('notes.txt');
    expect(file.type).toBe('text/plain');
  });

  it('listDocuments() GETs the documents sub-route', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [{ fileName: 'a.txt' }] })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const docs = await client.knowledge.listDocuments('kb1');
    expect(docs).toEqual([{ fileName: 'a.txt' }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/knowledge/kb1/documents');
  });

  it('deleteDocument() DELETEs the documents/{sourceName} sub-route, URL-encoded', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { removedChunks: 3, remainingDocuments: 0, remainingChunks: 0 },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.knowledge.deleteDocument('kb1', 'my file.txt');
    expect(result.removedChunks).toBe(3);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.example.com/api/v1/developer/knowledge/kb1/documents/my%20file.txt'
    );
    expect(init.method).toBe('DELETE');
  });

  it('search() POSTs { query, topK } to the search sub-route', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [{ text: 'x', source: 'a.txt', score: 0.9 }] })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const results = await client.knowledge.search('kb1', 'refund policy', { topK: 3 });
    expect(results).toEqual([{ text: 'x', source: 'a.txt', score: 0.9 }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/knowledge/kb1/search');
    expect(JSON.parse(init.body as string)).toEqual({ query: 'refund policy', topK: 3 });
  });

  it('getUsage() GETs the usage sub-route and returns agent count + preview', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const usage = await client.knowledge.getUsage('kb1');
    expect(usage).toEqual({ agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/knowledge/kb1/usage');
    expect(init.method).toBe('GET');
  });

  it('bulkDelete() POSTs { ids } to the bulk-delete sub-route and returns { deleted, failed }', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { deleted: ['kb1'], failed: [{ id: 'kb2', reason: 'Knowledge base not found' }] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.knowledge.bulkDelete(['kb1', 'kb2']);
    expect(result).toEqual({
      deleted: ['kb1'],
      failed: [{ id: 'kb2', reason: 'Knowledge base not found' }],
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/knowledge/bulk-delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ ids: ['kb1', 'kb2'] });
  });
});
