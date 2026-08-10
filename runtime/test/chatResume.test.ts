import { describe, expect, it, vi } from 'vitest';
import { EventType } from '@personaai/sdk';
import { sseResponse, makeRuntime } from './helpers.js';

async function drain(body: AsyncIterable<string>): Promise<string[]> {
  const frames: string[] = [];
  for await (const chunk of body) frames.push(chunk);
  return frames;
}

describe('POST /chat + GET /chat/:runId/resume', () => {
  it('POST /chat returns an x-persona-run-id header', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      sseResponse([{ type: EventType.TEXT_MESSAGE_CHUNK, delta: 'hi' }])
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [] },
      userId: null,
    });

    expect(response.headers['x-persona-run-id']).toBeTruthy();
  });

  it('a reconnect replays missed frames after a partial read, without firing hooks twice', async () => {
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'one' },
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'two' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const afterRun = vi.fn();
    const runtime = makeRuntime({ fetchMock, hooks: { afterRun } });

    const first = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [] },
      userId: null,
    });
    if (first.kind !== 'stream') throw new Error('expected stream');
    const runId = first.headers['x-persona-run-id']!;

    // "Disconnect": read only the first frame, then abandon the iterator —
    // matches an adapter giving up on a dropped connection. The driver's
    // pump keeps running in the background regardless (that's the whole
    // point), so the rest of the run completes on its own.
    const firstIterator = first.body[Symbol.asyncIterator]();
    const firstFrame = await firstIterator.next();
    expect(firstFrame.value).toBe(`data: ${JSON.stringify(events[0])}\n\n`);
    await firstIterator.return?.();

    await vi.waitFor(() => expect(afterRun).toHaveBeenCalledTimes(1));

    // Reconnect from seq 0 (i.e. "I already have frame 0").
    const resumed = await runtime.handle({
      method: 'GET',
      path: `/chat/${runId}/resume`,
      headers: {},
      query: { since: '0' },
      body: undefined,
      userId: null,
    });
    if (resumed.kind !== 'stream') throw new Error('expected stream');

    const missedFrames = await drain(resumed.body);
    expect(missedFrames).toEqual(
      [events[1], events[2]].map((e) => `data: ${JSON.stringify(e)}\n\n`)
    );
    expect(afterRun).toHaveBeenCalledTimes(1); // never fires a second time for a reconnect
  });

  it('resuming with no ?since replays every buffered frame from the start', async () => {
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'a' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const runtime = makeRuntime({ fetchMock });

    const first = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [] },
      userId: null,
    });
    if (first.kind !== 'stream') throw new Error('expected stream');
    const runId = first.headers['x-persona-run-id']!;
    await drain(first.body);

    const resumed = await runtime.handle({
      method: 'GET',
      path: `/chat/${runId}/resume`,
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });
    if (resumed.kind !== 'stream') throw new Error('expected stream');
    expect(await drain(resumed.body)).toEqual(events.map((e) => `data: ${JSON.stringify(e)}\n\n`));
  });

  it('returns 404 for an unknown runId', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 })
    );
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'GET',
      path: '/chat/does-not-exist/resume',
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });

    expect(response.status).toBe(404);
  });

  it('returns 404 (not 403) when resuming a run that belongs to a different user', async () => {
    const events = [{ type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' }];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    let call = 0;
    const runtime = makeRuntime({
      fetchMock,
      resolveUser: () => (call++ === 0 ? 'user-1' : 'user-2'),
    });

    const first = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [] },
      userId: null,
    });
    if (first.kind !== 'stream') throw new Error('expected stream');
    const runId = first.headers['x-persona-run-id']!;
    await drain(first.body);

    const resumed = await runtime.handle({
      method: 'GET',
      path: `/chat/${runId}/resume`,
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });
    expect(resumed.status).toBe(404);
  });
});
