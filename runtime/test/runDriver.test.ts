import { describe, expect, it } from 'vitest';
import { EventType, type AguiEvent } from '@personaai/sdk';
import { RunDriver } from '../src/runDriver.js';

/**
 * `RunDriver`'s pump is deliberately NOT backpressure-coupled to its
 * subscribers — this is an inherent tradeoff of supporting reconnect, not
 * an oversight. A driver starts draining its upstream generator the moment
 * it's constructed and keeps going regardless of whether anyone is
 * listening, because resumability requires buffering whatever a
 * reconnecting client might ask to replay. (Contrast the v0.3 design,
 * before reconnect existed: a slow/disconnected consumer *did* propagate
 * backpressure all the way back to Persona's server. That guarantee is
 * gone for `/chat` runs now — see the README's "Heartbeats and
 * backpressure" section.) What's tested here instead is the correctness
 * property that actually still holds: the pump drains the upstream
 * generator exactly once, strictly in order, no matter how many
 * subscribers attach or how fast they read.
 */
describe('RunDriver pump/subscriber correctness', () => {
  it('the pump drains the entire upstream generator eagerly, independent of any subscriber', async () => {
    const events: AguiEvent[] = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'a' } as AguiEvent,
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'b' } as AguiEvent,
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' } as AguiEvent,
    ];

    let nextCallCount = 0;
    async function* upstream(): AsyncGenerator<AguiEvent> {
      for (const event of events) {
        nextCallCount += 1;
        yield event;
      }
    }

    const runCtx = { userId: 'user-1', agentId: 'agent-1', messages: [] };
    const driver = new RunDriver('run-1', runCtx, upstream(), undefined, 'production');

    // waitForFirstFrame() only guarantees the *first* push has happened —
    // the pump keeps running independently afterwards, so how far it's
    // gotten by then is a race, not a guarantee. Wait for it to actually
    // finish (draining a subscriber to completion does that) before
    // asserting how much of the upstream it drained in total.
    await driver.waitForFirstFrame();
    const frames: string[] = [];
    for await (const frame of driver.subscribe(-1)) frames.push(frame);

    expect(nextCallCount).toBe(3);
    expect(driver.frameCount).toBe(3);
    expect(driver.isFinished()).toBe(true);
    expect(frames).toEqual(events.map((e) => `data: ${JSON.stringify(e)}\n\n`));

    // A second, late subscriber gets every buffered frame from the replay
    // path, not by re-triggering the upstream generator.
    const secondFrames: string[] = [];
    for await (const frame of driver.subscribe(-1)) secondFrames.push(frame);
    expect(secondFrames).toEqual(frames);
    expect(nextCallCount).toBe(3);
  });

  it('subscribe(sinceSeq) only replays frames after the given sequence number', async () => {
    const events: AguiEvent[] = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'a' } as AguiEvent,
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'b' } as AguiEvent,
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' } as AguiEvent,
    ];
    async function* upstream(): AsyncGenerator<AguiEvent> {
      for (const event of events) yield event;
    }

    const runCtx = { userId: 'user-1', agentId: 'agent-1', messages: [] };
    const driver = new RunDriver('run-1', runCtx, upstream(), undefined, 'production');
    await driver.waitForFirstFrame();

    const frames: string[] = [];
    for await (const frame of driver.subscribe(0)) frames.push(frame);
    expect(frames).toEqual([events[1], events[2]].map((e) => `data: ${JSON.stringify(e)}\n\n`));
  });

  it('a subscriber attached before the run finishes receives buffered frames then live ones, without duplication', async () => {
    let releaseSecond: (() => void) | undefined;
    const secondGate = new Promise<void>((resolve) => (releaseSecond = resolve));

    async function* upstream(): AsyncGenerator<AguiEvent> {
      yield { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'a' } as AguiEvent;
      await secondGate;
      yield { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' } as AguiEvent;
    }

    const runCtx = { userId: 'user-1', agentId: 'agent-1', messages: [] };
    const driver = new RunDriver('run-1', runCtx, upstream(), undefined, 'production');
    await driver.waitForFirstFrame();

    const collected: string[] = [];
    const drain = (async () => {
      for await (const frame of driver.subscribe(-1)) collected.push(frame);
    })();

    releaseSecond?.();
    await drain;

    expect(collected).toEqual([
      `data: ${JSON.stringify({ type: EventType.TEXT_MESSAGE_CHUNK, delta: 'a' })}\n\n`,
      `data: ${JSON.stringify({ type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' })}\n\n`,
    ]);
  });

  it('abandoning a subscription mid-stream unregisters its listener instead of leaking it', async () => {
    async function* upstream(): AsyncGenerator<AguiEvent> {
      yield { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'a' } as AguiEvent;
      await new Promise(() => {}); // never resolves — keeps the run "in-flight" so the subscription stays live
    }

    const runCtx = { userId: 'user-1', agentId: 'agent-1', messages: [] };
    const driver = new RunDriver('run-1', runCtx, upstream(), undefined, 'production');
    await driver.waitForFirstFrame();

    const iterator = driver.subscribe(-1)[Symbol.asyncIterator]();
    await iterator.next(); // consumes the one buffered frame, registers the live listener
    expect(driver.subscriberCount).toBe(1);

    await iterator.return?.();
    expect(driver.subscriberCount).toBe(0);
  });

  it('withHeartbeats propagates an early return() down to the underlying subscription (the same path an adapter uses on disconnect)', async () => {
    const { withHeartbeats } = await import('../src/heartbeat.js');

    async function* upstream(): AsyncGenerator<AguiEvent> {
      yield { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'a' } as AguiEvent;
      await new Promise(() => {});
    }

    const runCtx = { userId: 'user-1', agentId: 'agent-1', messages: [] };
    const driver = new RunDriver('run-1', runCtx, upstream(), undefined, 'production');
    await driver.waitForFirstFrame();

    const wrapped = withHeartbeats(driver.subscribe(-1), 15000);
    const iterator = wrapped[Symbol.asyncIterator]();
    await iterator.next();
    expect(driver.subscriberCount).toBe(1);

    await iterator.return?.(undefined);
    expect(driver.subscriberCount).toBe(0);
  });
});
