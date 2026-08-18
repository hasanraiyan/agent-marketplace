import type { RuntimeResponse } from '@personaai/runtime';

function waitForDrainOrClose(res: any): Promise<void> {
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

export async function writeRuntimeResponse(
  res: any,
  response: RuntimeResponse
): Promise<void> {
  res.status(response.status);
  for (const [key, value] of Object.entries(response.headers)) {
    res.set ? res.set(key, value) : res.setHeader?.(key, value);
  }

  if (response.kind === 'buffered') {
    res.end(response.body);
    return;
  }

  if (typeof res.setHeader === 'function') {
    res.setHeader('X-Accel-Buffering', 'no');
  }

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const body = response.body as AsyncIterable<string | Uint8Array>;
  const iterator = body[Symbol.asyncIterator]();
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
      if (typeof res.flush === 'function') {
        res.flush();
      }
      if (!canContinue) await waitForDrainOrClose(res);
    }
    if (!closed) res.end();
  } finally {
    res.off('close', onClose);
  }
}
