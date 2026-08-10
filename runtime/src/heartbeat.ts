/** An SSE comment line — ignored by any `data:`-only parser (including `@personaai/sdk`'s own), never changes the AG-UI event sequence a consumer sees. */
const HEARTBEAT_FRAME = ': heartbeat\n\n';

const TIMEOUT = Symbol('heartbeat-timeout');

function heartbeatTimer(ms: number): { promise: Promise<typeof TIMEOUT>; cancel: () => void } {
  let handle: ReturnType<typeof setTimeout>;
  const promise = new Promise<typeof TIMEOUT>((resolve) => {
    handle = setTimeout(() => resolve(TIMEOUT), ms);
  });
  return { promise, cancel: () => clearTimeout(handle) };
}

/**
 * Interleaves `HEARTBEAT_FRAME`s into any SSE frame source during a gap
 * longer than `intervalMs` between real frames, without breaking pull-based
 * backpressure: `source`'s iterator's `next()` is only ever called once per
 * real frame — a heartbeat firing just re-races the *same* pending `next()`
 * promise against a fresh timer, it never issues an extra pull ahead of
 * what the consumer has actually asked for.
 *
 * Always calls the underlying iterator's `return()` on the way out — via
 * the `finally` block, which fires whether this generator runs to
 * completion, throws, or is torn down early by its own consumer (e.g. an
 * adapter cancelling because the client disconnected). This matters when
 * `source` is a `RunDriver.subscribe()` iterable: skipping it would leak
 * that subscription's listener registration for the lifetime of the run.
 */
export async function* withHeartbeats(
  source: AsyncIterable<string>,
  intervalMs = 15000
): AsyncGenerator<string> {
  const iterator = source[Symbol.asyncIterator]();

  try {
    let pending: Promise<IteratorResult<string>> | null = null;

    for (;;) {
      pending ??= iterator.next();
      const timer = heartbeatTimer(intervalMs);
      const winner = await Promise.race([pending, timer.promise]);
      timer.cancel();

      if (winner === TIMEOUT) {
        yield HEARTBEAT_FRAME;
        continue; // re-race the same pending next() call, no extra pull
      }

      pending = null;
      if (winner.done) return;
      yield winner.value;
    }
  } finally {
    await iterator.return?.();
  }
}
