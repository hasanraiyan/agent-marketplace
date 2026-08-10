import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { toExpressRouter } from '../src/index.js';
import { createTestApp, listen, makeFakeRuntime, waitFor } from './helpers.js';

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers) server.close();
  servers.length = 0;
});

describe('SSE streaming via Express response', () => {
  it('commits headers first, then streams frames verbatim and in order', async () => {
    const runtime = makeFakeRuntime(async () => ({
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'x-persona-run-id': 'run-1' },
      body: (async function* () {
        yield 'data: {"type":"RUN_STARTED"}\n\n';
        yield 'data: {"type":"TEXT","delta":"hi"}\n\n';
        yield 'data: {"type":"RUN_COMPLETED"}\n\n';
      })(),
    }));
    const app = createTestApp(toExpressRouter(runtime));
    const { server, baseUrl } = await listen(app);
    servers.push(server);

    const res = await fetch(`${baseUrl}/api/persona/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentId: 'a', messages: [] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(res.headers.get('x-persona-run-id')).toBe('run-1');
    expect(await res.text()).toBe(
      'data: {"type":"RUN_STARTED"}\n\ndata: {"type":"TEXT","delta":"hi"}\n\ndata: {"type":"RUN_COMPLETED"}\n\n'
    );
  });

  it('tears down the runtime stream when the client disconnects mid-stream', async () => {
    let returned = false;
    const runtime = makeFakeRuntime(async () => ({
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      // The generator must be suspended at a `yield` when the client hangs up
      // so `iterator.return()` can inject immediately; a parked inner `await`
      // would block it forever. Heartbeat comment lines are valid SSE and are
      // invisible to any `data:`-only parser, matching the runtime's own
      // heartbeat behavior.
      body: (async function* () {
        try {
          yield 'data: {"type":"a"}\n\n';
          yield 'data: {"type":"b"}\n\n';
          while (true) {
            yield ': heartbeat\n\n';
            await new Promise((r) => setTimeout(r, 10));
          }
        } finally {
          returned = true;
        }
      })(),
    }));
    const app = createTestApp(toExpressRouter(runtime));
    const { server, baseUrl } = await listen(app);
    servers.push(server);

    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/persona/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentId: 'a', messages: [] }),
      signal: controller.signal,
    });
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    await reader.read();
    await reader.read();
    controller.abort();
    await reader.cancel().catch(() => {});

    await waitFor(() => returned === true, 4000);
  }, 10000);
});
