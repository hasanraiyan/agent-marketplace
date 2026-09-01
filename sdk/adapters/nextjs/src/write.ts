import type { RuntimeResponse } from '@personaai/runtime';

/** Statuses the Fetch spec forbids a body on — `new Response('', { status: 204 })` throws. */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/**
 * Turns a runtime response into a Web `Response`.
 *
 * - `buffered`: the body is already serialized — hand it over verbatim.
 * - `stream` / `binary`: a pull-based `ReadableStream`, so the runtime's
 *   async iterable is only advanced when the platform is ready for the next
 *   chunk (backpressure). `cancel()` — which Next/undici calls when the
 *   client disconnects — invokes `iterator.return()` so the runtime's
 *   RunDriver unsubscribes instead of pumping into a dead socket.
 */
export function toWebResponse(response: RuntimeResponse): Response {
  const headers = new Headers(response.headers);

  if (response.kind === 'buffered') {
    const body = NULL_BODY_STATUSES.has(response.status) ? null : response.body;
    return new Response(body, { status: response.status, headers });
  }

  if (response.kind === 'stream') {
    // Next.js won't buffer a streamed response, but an nginx/ingress proxy in
    // front of it will unless told otherwise — without this an SSE chat looks
    // frozen until the run finishes.
    if (!headers.has('x-accel-buffering')) headers.set('x-accel-buffering', 'no');
  }

  const encoder = new TextEncoder();
  const iterator = (response.body as AsyncIterable<string | Uint8Array>)[Symbol.asyncIterator]();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(typeof value === 'string' ? encoder.encode(value) : value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Response(stream, { status: response.status, headers });
}
