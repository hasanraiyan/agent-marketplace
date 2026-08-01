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

describe('FilesResource', () => {
  it('upload() sends a multipart FormData body under the "file" field, plus optional agentId/threadId', async () => {
    const uploaded = {
      id: 'f1',
      originalName: 'resume.pdf',
      mimeType: 'application/pdf',
      size: 1234,
      agentId: 'a1',
      threadId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: uploaded }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.files.upload({
      filename: 'resume.pdf',
      content: new TextEncoder().encode('%PDF-1.4 fake'),
      contentType: 'application/pdf',
      agentId: 'a1',
    });

    expect(result).toEqual(uploaded);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/files');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);

    const form = init.body as FormData;
    const file = form.get('file') as File;
    expect(file.name).toBe('resume.pdf');
    expect(file.type).toBe('application/pdf');
    expect(form.get('agentId')).toBe('a1');
    expect(form.get('threadId')).toBeNull();
  });

  it('list() returns a bare array and forwards query params', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [{ id: 'f1' }] })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.files.list({ page: 2, limit: 5 });
    expect(result).toEqual([{ id: 'f1' }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/files?page=2&limit=5');
  });

  it('download() returns the raw non-JSON Response', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(new Blob(['file bytes']), {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const response = await client.files.download('f1');
    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/files/f1');
  });

  it('delete() DELETEs the file', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, message: 'File deleted successfully' })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.files.delete('f1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/files/f1');
    expect(init.method).toBe('DELETE');
  });
});
