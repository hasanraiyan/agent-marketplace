import type { RuntimeResponse } from '@personaai/runtime';
import type { Logger } from '@personaai/logger';
import { createLogger } from '@personaai/logger';

/** Statuses the Fetch spec forbids a body on — `new Response('', { status: 204 })` throws. */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/**
 * Turns a runtime response into a Web `Response`.
 * Unified from nextjs/src/write.ts.
 */
export function toWebResponse(response: RuntimeResponse, logger?: Logger): Response {
  const wLogger = (logger ?? createLogger('adapter:nextjs')).child('write');
  const headers = new Headers(response.headers);
  wLogger.debug('toWebResponse start', { status: response.status, kind: response.kind });
  wLogger.trace('response headers', {
    headers: Object.fromEntries(headers.entries()),
    status: response.status,
  });

  if (response.kind === 'buffered') {
    const body = NULL_BODY_STATUSES.has(response.status) ? null : response.body;
    wLogger.info('buffered response', { status: response.status, hasBody: !!body });
    return new Response(body, { status: response.status, headers });
  }

  if (response.kind === 'stream') {
    if (!headers.has('x-accel-buffering')) headers.set('x-accel-buffering', 'no');
    wLogger.debug('stream response', { status: response.status });
  } else {
    wLogger.debug('binary response', { status: response.status });
  }

  const encoder = new TextEncoder();
  const iterator = (response.body as AsyncIterable<string | Uint8Array>)[Symbol.asyncIterator]();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          wLogger.debug('stream done');
          controller.close();
          return;
        }
        wLogger.trace('stream chunk', {
          length: typeof value === 'string' ? value.length : (value as Uint8Array).length,
        });
        controller.enqueue(typeof value === 'string' ? encoder.encode(value) : value);
      } catch (err) {
        wLogger.error('stream pull error', { error: err instanceof Error ? err.message : String(err) });
        controller.error(err);
      }
    },
    async cancel() {
      wLogger.warn('client disconnect — cancel stream', {});
      await iterator.return?.();
      wLogger.debug('stream cancelled');
    },
  });

  return new Response(stream, { status: response.status, headers });
}
