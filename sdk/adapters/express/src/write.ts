import type { Response } from 'express';
import type { RuntimeResponse } from '@personaai/runtime';

function waitForDrainOrClose(res: Response): Promise<void> {
  return new Promise<void>((resolve) => {
    const cleanup = () => {
      res.off('drain', onDrain);
      res.off('close', onClose);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      resolve();
    };
    res.once('drain', onDrain);
    res.once('close', onClose);
  });
}

/**
 * Writes a runtime response onto an Express response.
 *
 * - `buffered`: the body is pre-serialized — end() it verbatim.
 * - `stream` / `binary`: commit headers, then pump the async iterable with
 *   drain-based backpressure. On client disconnect, `iterator.return()` is
 *   invoked so the runtime's RunDriver unsubscribes instead of pumping to a
 *   dead socket.
 */
export async function writeRuntimeResponse(
  res: Response,
  response: RuntimeResponse
): Promise<void> {
  res.status(response.status);
  for (const [key, value] of Object.entries(response.headers)) res.set(key, value);

  if (response.kind === 'buffered') {
    res.end(response.body);
    return;
  }

  res.flushHeaders();

  const body = response.body as AsyncIterable<string | Uint8Array>;
  const iterator = body[Symbol.asyncIterator]();
  // Iterate via a wrapper over the SAME iterator we hold: for-await needs an
  // AsyncIterable, and a fresh `body[Symbol.asyncIterator]()` call (e.g. the
  // runtime's RunDriver subscription) could return a different iterator that
  // `iterator.return()` below wouldn't cancel.
  const iterable: AsyncIterable<string | Uint8Array> = { [Symbol.asyncIterator]: () => iterator };
  let closed = false;
  const onClose = () => {
    closed = true;
    const returned = iterator.return?.();
    if (returned) void returned.catch(() => {});
  };
  res.on('close', onClose);

  try {
    for await (const chunk of iterable) {
      if (closed) break;
      const canContinue = res.write(chunk);
      if (!canContinue) await waitForDrainOrClose(res);
    }
    if (!closed) res.end();
  } finally {
    res.off('close', onClose);
  }
}
