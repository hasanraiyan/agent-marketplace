import { describe, expect, it } from 'vitest';
import { EventType, type AguiEvent } from '@personaai/sdk';
import { chatEventsToSseBody } from '../src/sse.js';

/**
 * Tests `chatEventsToSseBody` directly against a hand-instrumented async
 * generator, rather than going through a real `ReadableStream`/`fetch()`.
 * A raw `ReadableStream` has its own WHATWG-spec single-chunk lookahead
 * (every stream prefetches one chunk ahead of what's been `read()` to keep
 * its internal queue at `highWaterMark`) — that's normal platform behavior
 * present in *any* fetch-based consumer, not something this runtime
 * controls or introduces. What this runtime actually guarantees is
 * narrower and lives one layer up: `chatEventsToSseBody` itself never
 * calls the upstream generator's `next()` more than once per SSE frame the
 * *consumer* has asked for — this test isolates exactly that boundary.
 */
describe('chatEventsToSseBody backpressure', () => {
  it('never calls next() on the upstream generator ahead of what the consumer has drained', async () => {
    const events: AguiEvent[] = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'a' } as AguiEvent,
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'b' } as AguiEvent,
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' } as AguiEvent,
    ];

    let nextCallCount = 0;
    async function* upstream(): AsyncGenerator<AguiEvent> {
      // events[0] is the "first" event, peeked by the caller before this
      // generator is even constructed — start from index 1.
      for (let i = 1; i < events.length; i++) {
        nextCallCount += 1;
        yield events[i]!;
      }
    }

    const gen = upstream();
    const runCtx = { userId: 'user-1', agentId: 'agent-1', messages: [] };
    const body = chatEventsToSseBody(events[0]!, gen, runCtx, undefined, 'production', 15000);

    // Nothing has been drained yet — the generator body hasn't run past its
    // first `await` until we call .next() on it.
    expect(nextCallCount).toBe(0);

    const first = await body.next();
    expect(first.value).toBe(`data: ${JSON.stringify(events[0])}\n\n`);
    // Draining the peeked first frame must not have pulled a second event —
    // that only happens once the consumer asks for the *next* SSE frame.
    expect(nextCallCount).toBe(0);

    const second = await body.next();
    expect(second.value).toBe(`data: ${JSON.stringify(events[1])}\n\n`);
    expect(nextCallCount).toBe(1);

    const third = await body.next();
    expect(third.value).toBe(`data: ${JSON.stringify(events[2])}\n\n`);
    expect(nextCallCount).toBe(2);

    const fourth = await body.next();
    expect(fourth.done).toBe(true);
    expect(nextCallCount).toBe(2);
  });
});
