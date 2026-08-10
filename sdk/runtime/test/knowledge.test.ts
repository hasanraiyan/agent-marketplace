import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

function withCapability(overrides: Parameters<typeof makeRuntime>[0]) {
  return makeRuntime({ ...overrides, capabilities: { knowledge: true } });
}

describe('knowledge routes (capabilities.knowledge)', () => {
  it('POST /knowledge creates a knowledge base', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ _id: 'kb1' }, 201)
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/knowledge',
      headers: {},
      query: {},
      body: { name: 'Docs', providerId: 'p1' },
      userId: null,
    });

    expect(response.status).toBe(201);
  });

  it('POST /knowledge without required fields returns 400', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/knowledge',
      headers: {},
      query: {},
      body: { name: 'Docs' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /knowledge/:id/documents uploads multiple files at once (multipart) and fails cleanly with none', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init!.body as FormData;
      expect(form.getAll('files').length).toBe(2);
      return jsonResponse(
        {
          documentCount: 2,
          chunkCount: 10,
          files: [{ fileName: 'a.txt', fileSize: 3, mimeType: 'text/plain', chunkCount: 5 }],
        },
        201
      );
    });
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/knowledge/kb1/documents',
      headers: {},
      query: {},
      body: {},
      files: [
        { filename: 'a.txt', content: new TextEncoder().encode('hi!'), contentType: 'text/plain' },
        { filename: 'b.txt', content: new TextEncoder().encode('yo!'), contentType: 'text/plain' },
      ],
      userId: null,
    });

    expect(response.status).toBe(201);
  });

  it('POST /knowledge/:id/documents without any files returns 400', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/knowledge/kb1/documents',
      headers: {},
      query: {},
      body: {},
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /knowledge/:id/documents lists documents', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([]));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/knowledge/kb1/documents',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
  });

  it('DELETE /knowledge/:id/documents/:sourceName deletes a document', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ removedChunks: 5, remainingDocuments: 1, remainingChunks: 5 })
    );
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/knowledge/kb1/documents/a.txt',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/documents/a.txt');
  });

  it('POST /knowledge/:id/search forwards query and topK', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(init!.body as string)).toEqual({ query: 'refunds', topK: 3 });
      return jsonResponse([{ text: 'chunk', source: 'a.txt', score: 0.9 }]);
    });
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/knowledge/kb1/search',
      headers: {},
      query: {},
      body: { query: 'refunds', topK: 3 },
      userId: null,
    });

    expect(response.status).toBe(200);
  });
});
