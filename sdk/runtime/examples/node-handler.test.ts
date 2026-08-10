import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventType } from '@personaai/sdk';
import { createRuntime } from '../src/index.js';
import { toNodeHandler } from './node-handler.js';

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

function listen(
  handler: (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse
  ) => void
): Promise<string> {
  return new Promise((resolve) => {
    server = createServer(handler);
    server.listen(0, () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

describe('toNodeHandler', () => {
  it('round-trips a buffered JSON route over real HTTP', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ domain: 'd1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    );
    const runtime = createRuntime({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
      resolveUser: () => 'user-1',
    });

    const baseUrl = await listen(toNodeHandler(runtime));
    const res = await fetch(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('round-trips the chat SSE route over real HTTP, streaming chunked frames', async () => {
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'Hello' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const event of events)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    });
    const runtime = createRuntime({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
      resolveUser: () => 'user-1',
    });

    const baseUrl = await listen(toNodeHandler(runtime));
    const res = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentId: 'agent-1', messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    const text = await res.text();
    expect(text).toBe(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''));
  });

  it('round-trips a real multipart file upload, parsed via native Request/FormData', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init!.body as FormData;
      const file = form.get('file') as File;
      expect(file.name).toBe('hello.txt');
      expect(await file.text()).toBe('hello world');
      expect(form.get('agentId')).toBe('agent-1');

      return new Response(
        JSON.stringify({
          success: true,
          data: { id: 'f1', originalName: 'hello.txt', mimeType: 'text/plain', size: 11 },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    });
    const runtime = createRuntime({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
      resolveUser: () => 'user-1',
    });

    const baseUrl = await listen(toNodeHandler(runtime));

    const form = new FormData();
    form.set('file', new File(['hello world'], 'hello.txt', { type: 'text/plain' }));
    form.set('agentId', 'agent-1');

    const res = await fetch(`${baseUrl}/files`, { method: 'POST', body: form });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { originalName: string };
    expect(body.originalName).toBe('hello.txt');
  });
});
