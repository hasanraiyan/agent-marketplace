import { vi } from 'vitest';
import {
  createRuntime,
  type CreateRuntimeOptions,
  type ResolveUser,
  type RuntimeHooks,
} from '../src/index.js';

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data: body }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function jsonErrorResponse(status: number, message: string, code = 'ERROR'): Response {
  return new Response(JSON.stringify({ success: false, message, code }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function sseResponse(events: unknown[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } });
}

export function makeRuntime(overrides: {
  fetchMock: ReturnType<typeof vi.fn>;
  resolveUser?: ResolveUser;
  hooks?: RuntimeHooks;
  mode?: CreateRuntimeOptions['mode'];
  mountPath?: string;
}) {
  return createRuntime({
    baseUrl: 'https://api.example.com',
    credential: 'key.secret',
    fetch: overrides.fetchMock as unknown as typeof fetch,
    resolveUser: overrides.resolveUser ?? (() => 'user-1'),
    hooks: overrides.hooks,
    mode: overrides.mode,
    mountPath: overrides.mountPath,
  });
}
