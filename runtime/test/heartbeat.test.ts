import { describe, expect, it, vi } from 'vitest';
import { EventType } from '@personaai/sdk';
import { delayedSseResponse, sseResponse, makeRuntime } from './helpers.js';

async function drain(body: AsyncIterable<string>): Promise<string[]> {
  const frames: string[] = [];
  for await (const chunk of body) frames.push(chunk);
  return frames;
}

describe('POST /chat heartbeats', () => {
  it('sends a heartbeat comment frame during a gap between events, then delivers the real event', async () => {
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'slow' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    // Each event is delayed well past the 15ms heartbeat interval, so at
    // least one heartbeat frame must appear before each of them.
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      delayedSseResponse(events, 60)
    );
    const runtime = makeRuntime({ fetchMock, heartbeatIntervalMs: 15 });

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

    const heartbeatFrames = frames.filter((f) => f === ': heartbeat\n\n');
    const dataFrames = frames.filter((f) => f.startsWith('data:'));

    expect(heartbeatFrames.length).toBeGreaterThan(0);
    expect(dataFrames).toEqual([
      `data: ${JSON.stringify(events[0])}\n\n`,
      `data: ${JSON.stringify(events[1])}\n\n`,
    ]);
    // Heartbeats must come before the real event they preceded, not after.
    expect(frames.indexOf(heartbeatFrames[0]!)).toBeLessThan(frames.lastIndexOf(dataFrames[1]!));
  });

  it('emits no heartbeats when events arrive faster than the interval', async () => {
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'fast' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const runtime = makeRuntime({ fetchMock, heartbeatIntervalMs: 15000 });

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

    expect(frames.some((f) => f === ': heartbeat\n\n')).toBe(false);
    expect(frames).toEqual([
      `data: ${JSON.stringify(events[0])}\n\n`,
      `data: ${JSON.stringify(events[1])}\n\n`,
    ]);
  });
});
