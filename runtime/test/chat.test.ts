import { describe, expect, it, vi } from 'vitest';
import { EventType } from '@personaai/sdk';
import { jsonErrorResponse, sseResponse, makeRuntime } from './helpers.js';

async function drain(body: AsyncIterable<string>): Promise<string[]> {
  const frames: string[] = [];
  for await (const chunk of body) frames.push(chunk);
  return frames;
}

describe('POST /chat', () => {
  it('returns SSE headers and formats frames as data: <json>\\n\\n with no event:/id: lines', async () => {
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'Hi' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [{ role: 'user', content: 'hi' }] },
      userId: null,
    });

    expect(response.status).toBe(200);
    expect(response.kind).toBe('stream');
    if (response.kind !== 'stream') return;
    expect(response.headers['content-type']).toBe('text/event-stream');

    const frames = await drain(response.body);
    expect(frames).toEqual([
      `data: ${JSON.stringify(events[0])}\n\n`,
      `data: ${JSON.stringify(events[1])}\n\n`,
    ]);
  });

  it('fires beforeRun before the stream is consumed, afterRun once it completes', async () => {
    const order: string[] = [];
    const events = [{ type: EventType.TEXT_MESSAGE_CHUNK, delta: 'hi' }];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const runtime = makeRuntime({
      fetchMock,
      hooks: {
        beforeRun: async () => {
          order.push('beforeRun');
        },
        afterRun: async () => {
          order.push('afterRun');
        },
      },
    });

    const response = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [] },
      userId: null,
    });

    expect(order).toEqual(['beforeRun']);
    if (response.kind === 'stream') await drain(response.body);
    expect(order).toEqual(['beforeRun', 'afterRun']);
  });

  it('afterRun still fires (with erroredInBand: true) when the last event is RUN_ERROR', async () => {
    let capturedResult: unknown;
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'partial' },
      {
        type: EventType.RUN_ERROR,
        code: 'PROVIDER_AUTH_ERROR',
        message: 'bad key',
        retryable: false,
      },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const runtime = makeRuntime({
      fetchMock,
      hooks: { afterRun: (_ctx, result) => void (capturedResult = result) },
    });

    const response = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [] },
      userId: null,
    });
    if (response.kind === 'stream') await drain(response.body);

    expect(capturedResult).toMatchObject({ erroredInBand: true, text: 'partial', eventCount: 2 });
  });

  it('immediate failure (401 on the initial POST) returns a buffered error; onError called, afterRun not', async () => {
    const onError = vi.fn();
    const afterRun = vi.fn();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonErrorResponse(401, 'bad credential', 'PROVIDER_AUTH_ERROR')
    );
    const runtime = makeRuntime({ fetchMock, hooks: { onError, afterRun } });

    const response = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [] },
      userId: null,
    });

    expect(response.kind).toBe('buffered');
    expect(response.status).toBe(401);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(afterRun).not.toHaveBeenCalled();
  });

  it('mid-stream failure yields the good events then a synthesized RUN_ERROR frame, calls onError', async () => {
    const onError = vi.fn();
    const encoder = new TextEncoder();
    const goodEvent = { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'ok' };
    let pullCount = 0;
    // `pull()` fires once per `reader.read()` call, so this deterministically
    // delivers the good chunk on the first read and errors on the second —
    // unlike enqueueing then erroring inside `start()`, which the streams
    // spec resets the queue for before any read ever happens.
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        if (pullCount === 1) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(goodEvent)}\n\n`));
        } else {
          controller.error(new Error('connection reset'));
        }
      },
    });
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    );
    const runtime = makeRuntime({ fetchMock, hooks: { onError }, mode: 'production' });

    const response = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [] },
      userId: null,
    });

    expect(response.kind).toBe('stream');
    if (response.kind !== 'stream') return;
    const frames = await drain(response.body);

    expect(frames[0]).toBe(`data: ${JSON.stringify(goodEvent)}\n\n`);
    expect(frames).toHaveLength(2);
    const errorFrame = JSON.parse(frames[1]!.replace(/^data: /, '').trim());
    expect(errorFrame.type).toBe(EventType.RUN_ERROR);
    expect(errorFrame.code).toBe('INTERNAL_ERROR');
    expect(errorFrame.message).toBe('An internal error occurred.');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('a malformed body (missing agentId/messages) returns 400 and calls no hooks', async () => {
    const beforeRun = vi.fn();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([]));
    const runtime = makeRuntime({ fetchMock, hooks: { beforeRun } });

    const response = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { messages: [] },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(beforeRun).not.toHaveBeenCalled();
  });
});
