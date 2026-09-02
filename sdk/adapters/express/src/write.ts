import type { Response } from 'express';
import type { RuntimeResponse } from '@personaai/runtime';
import type { Logger } from '@personaai/sdk';

function waitForDrainOrClose(res: Response, logger?: Logger): Promise<void> {
  const log = logger?.child('write');
  return new Promise<void>((resolve) => {
    const cleanup = () => {
      res.off('drain', onDrain);
      res.off('close', onClose);
    };
    const onDrain = () => {
      log?.debug('write drain', {});
      log?.trace('write drain event', {});
      cleanup();
      resolve();
    };
    const onClose = () => {
      log?.warn('write close while waiting for drain', {});
      log?.trace('write close event during drain wait', {});
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
  response: RuntimeResponse,
  logger?: Logger
): Promise<void> {
  const log = logger?.child('write');
  const kind = response.kind;
  const status = response.status;
  log?.debug('write start', { kind, status });
  log?.trace('write headers', { headers: response.headers, status, kind });
  log?.info('response write start', { kind, status });

  res.status(response.status);
  for (const [key, value] of Object.entries(response.headers)) res.set(key, value);
  log?.trace('write headers set', { headerCount: Object.keys(response.headers).length });

  if (response.kind === 'buffered') {
    const bodyLength = response.body.length;
    log?.debug('write buffered', { status, bodyLength });
    log?.info('write buffered complete', { status, bodyLength });
    log?.trace('write buffered body preview', {
      preview: response.body.slice(0, 200),
      length: bodyLength,
    });
    res.end(response.body);
    log?.debug('write buffered ended', { status });
    return;
  }

  log?.info('write streaming start', { kind, status });
  log?.debug('flush headers', { kind, status });
  res.flushHeaders();
  log?.trace('headers flushed', { kind });

  const body = response.body as AsyncIterable<string | Uint8Array>;
  const iterator = body[Symbol.asyncIterator]();
  // Iterate via a wrapper over the SAME iterator we hold: for-await needs an
  // AsyncIterable, and a fresh `body[Symbol.asyncIterator]()` call (e.g. the
  // runtime's RunDriver subscription) could return a different iterator that
  // `iterator.return()` below wouldn't cancel.
  const iterable: AsyncIterable<string | Uint8Array> = { [Symbol.asyncIterator]: () => iterator };
  let closed = false;
  let chunkCount = 0;
  let bytesWritten = 0;
  const onClose = () => {
    closed = true;
    log?.warn('client disconnect — aborting stream', { kind, chunkCount, bytesWritten });
    log?.info('stream aborted by client', { kind, chunkCount });
    const returned = iterator.return?.();
    if (returned) void returned.catch(() => {});
    log?.trace('iterator.return called', { kind });
  };
  res.on('close', onClose);
  log?.trace('close listener attached', { kind });

  try {
    for await (const chunk of iterable) {
      if (closed) {
        log?.debug('stream closed mid-iteration — breaking', { chunkCount });
        break;
      }
      chunkCount++;
      const isString = typeof chunk === 'string';
      const len = isString ? (chunk as string).length : (chunk as Uint8Array).length;
      bytesWritten += len;
      log?.trace('write chunk', { kind, chunkCount, length: len, isString });
      if (chunkCount === 1) {
        log?.debug('first chunk', { kind, length: len });
      }
      const canContinue = res.write(chunk);
      log?.trace('write result', { canContinue, chunkCount, length: len });
      if (!canContinue) {
        log?.debug('write backpressure — waiting for drain', { chunkCount, bytesWritten });
        log?.info('backpressure detected', { chunkCount });
        await waitForDrainOrClose(res, logger);
        if (closed) {
          log?.warn('stream closed during backpressure wait', { chunkCount });
          break;
        }
        log?.debug('drain resolved — resuming', { chunkCount });
      }
    }
    if (!closed) {
      log?.info('stream completed', { kind, chunkCount, bytesWritten });
      log?.debug('ending response', { kind, chunkCount });
      res.end();
      log?.trace('response ended', { kind });
    } else {
      log?.debug('stream already closed — skipping end', { kind });
    }
  } catch (err) {
    log?.error('stream write failed', {
      kind,
      error: err instanceof Error ? err.message : String(err),
      chunkCount,
    });
    if (!res.headersSent) {
      log?.warn('stream error before headers — cannot send error body', { kind });
    }
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
    throw err;
  } finally {
    res.off('close', onClose);
    log?.trace('close listener detached', { kind, chunkCount });
    log?.debug('write finished', { kind, status, chunkCount, bytesWritten, closed });
  }
}
