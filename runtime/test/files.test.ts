import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

describe('files routes', () => {
  it('POST /files without a file part returns 400 without calling the API', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/files',
      headers: {},
      query: {},
      body: {},
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /files with a file uploads it as multipart and fires onFileUpload', async () => {
    const onFileUpload = vi.fn();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(FormData);
      return jsonResponse(
        { id: 'f1', originalName: 'a.txt', mimeType: 'text/plain', size: 3 },
        201
      );
    });
    const runtime = makeRuntime({ fetchMock, hooks: { onFileUpload } });

    const response = await runtime.handle({
      method: 'POST',
      path: '/files',
      headers: {},
      query: {},
      body: { agentId: 'agent-1' },
      file: {
        filename: 'a.txt',
        content: new TextEncoder().encode('hi!'),
        contentType: 'text/plain',
      },
      userId: null,
    });

    expect(response.status).toBe(201);
    expect(onFileUpload).toHaveBeenCalledWith({
      userId: 'user-1',
      fileName: 'a.txt',
      mimeType: 'text/plain',
    });
  });

  it('GET /files proxies to files.list with coerced page/limit', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [], pagination: {} })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/files',
      headers: {},
      query: { page: '2', limit: '5' },
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('page=2');
    expect(url).toContain('limit=5');
  });

  it('GET /files/:id streams the binary body through with content-type/disposition passed through', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'content-disposition': 'attachment; filename="a.txt"',
        },
      });
    });
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/files/f1',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.kind).toBe('binary');
    if (response.kind !== 'binary') return;
    expect(response.headers['content-type']).toBe('text/plain');
    expect(response.headers['content-disposition']).toBe('attachment; filename="a.txt"');

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.body) chunks.push(chunk);
    expect(chunks).toEqual([bytes]);
  });

  it('DELETE /files/:id returns 204', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'DELETE',
      path: '/files/f1',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(204);
  });
});
