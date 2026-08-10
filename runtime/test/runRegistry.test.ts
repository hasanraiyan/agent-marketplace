import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventType } from '@personaai/sdk';
import { evictStaleRuns } from '../src/runRegistry.js';
import { RunDriver } from '../src/runDriver.js';
import { createRuntime } from '../src/runtime.js';

async function* emptyGenerator() {
  // Zero events, completes immediately — RunDriver treats this as a valid finished run.
}

async function* neverGenerator(): AsyncGenerator<never> {
  // never resolves — simulates a still-in-flight run. The yield below is
  // structurally required (eslint's require-yield) but never reached.
  await new Promise<never>(() => {});
  yield undefined as never;
}

const runCtx = { userId: 'user-1', kind: 'chat' as const, agentId: 'agent-1', messages: [] };

/** A real, finished RunDriver — `finishedAt` reflects actual wall-clock completion time, so tests pass explicit `now` values relative to it rather than mocking global time. */
async function finishedDriver(id: string): Promise<RunDriver> {
  const driver = new RunDriver(id, runCtx, emptyGenerator(), undefined, 'production');
  await driver.waitForFirstFrame();
  // pump()'s afterRun/finish() run after firstFramePromise resolves — drain
  // a subscription to force the microtask queue forward until finish() has run.
  for await (const _frame of driver.subscribe(-1)) {
    // no frames expected; this just waits for the subscription to close, which only happens after finish()
  }
  return driver;
}

function inFlightDriver(id: string): RunDriver {
  return new RunDriver(id, runCtx, neverGenerator(), undefined, 'production');
}

describe('evictStaleRuns', () => {
  it('evicts a finished run older than the grace period', async () => {
    const driver = await finishedDriver('old');
    expect(driver.isFinished()).toBe(true);
    const runs = new Map<string, RunDriver>([['old', driver]]);

    evictStaleRuns(runs, driver.finishedAt! + 10_000, 5000);

    expect(runs.has('old')).toBe(false);
  });

  it('keeps a finished run within the grace period', async () => {
    const driver = await finishedDriver('recent');
    const runs = new Map<string, RunDriver>([['recent', driver]]);

    evictStaleRuns(runs, driver.finishedAt! + 1000, 5000);

    expect(runs.has('recent')).toBe(true);
  });

  it('never evicts a still-in-flight run, no matter how old the registry entry is treated', () => {
    const driver = inFlightDriver('in-flight');
    const runs = new Map<string, RunDriver>([['in-flight', driver]]);

    evictStaleRuns(runs, Date.now() + 999_999_999, 1);

    expect(runs.has('in-flight')).toBe(true);
  });

  it('evicts oldest-finished runs first once over the max-tracked cap, never touching in-flight runs', async () => {
    const early = await finishedDriver('finished-early');
    const late = await finishedDriver('finished-late');
    const running = inFlightDriver('still-running');
    const runs = new Map<string, RunDriver>([
      ['finished-early', early],
      ['finished-late', late],
      ['still-running', running],
    ]);

    // graceMs huge so nothing is evicted by age; maxTracked=2 forces the cap path.
    evictStaleRuns(runs, Date.now(), 1_000_000_000, 2);

    expect(runs.has('finished-early')).toBe(false); // oldest finished, evicted
    expect(runs.has('finished-late')).toBe(true);
    expect(runs.has('still-running')).toBe(true); // never evicted by the cap
  });

  it('is a no-op when under both the grace period and the cap', async () => {
    const a = await finishedDriver('a');
    const b = inFlightDriver('b');
    const runs = new Map<string, RunDriver>([
      ['a', a],
      ['b', b],
    ]);

    evictStaleRuns(runs, a.finishedAt!, 1_000_000, 100);

    expect(runs.size).toBe(2);
  });
});

describe('createRuntime({ runGraceMs, maxTrackedRuns }) wiring', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('actually reaches the periodic eviction sweep — a short runGraceMs makes a finished run unresumable after the next tick', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      const encoder = new TextEncoder();
      const event = { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' };
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
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
      runGraceMs: 100, // far shorter than the 60s sweep interval
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
    for await (const _frame of first.body) {
      // drain to completion so the run is actually finished before the sweep runs
    }

    await vi.advanceTimersByTimeAsync(60_000); // triggers exactly one eviction sweep

    const resumed = await runtime.handle({
      method: 'GET',
      path: `/chat/${runId}/resume`,
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });
    expect(resumed.status).toBe(404);

    runtime.close();
  });

  it('a long runGraceMs keeps a finished run resumable across a sweep tick', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      const encoder = new TextEncoder();
      const event = { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' };
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
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
      runGraceMs: 24 * 60 * 60 * 1000, // 1 day — outlives the sweep tick below
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
    for await (const _frame of first.body) {
      // drain to completion
    }

    await vi.advanceTimersByTimeAsync(60_000);

    const resumed = await runtime.handle({
      method: 'GET',
      path: `/chat/${runId}/resume`,
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });
    expect(resumed.status).toBe(200);

    runtime.close();
  });
});
