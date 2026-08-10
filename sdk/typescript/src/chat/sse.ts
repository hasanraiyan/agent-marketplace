import type { AguiEvent } from '../types/chat.js';

/**
 * Parses a `text/event-stream` `Response` body into a stream of AG-UI
 * events. Hand-rolled rather than using `@ag-ui/client`'s `HttpAgent` —
 * that package pulls in rxjs/fast-json-patch/uuid (a much heavier
 * dependency footprint than this SDK's "native fetch, no heavy deps"
 * design established since `HttpClient`), and its `RunAgentInput`-body
 * threadId semantics don't match this backend's own header-based routing
 * convention (`x-agent-id`/`x-thread-id`, confirmed by reading
 * `developerAgui.routes.js` directly) — spiked and rejected, not skipped.
 * `@ag-ui/core` alone (zod-only, no rxjs) supplies accurate event typing.
 * @param response - A `Response` whose body is a `text/event-stream`.
 * @yields Each parsed {@link AguiEvent}; malformed/partial SSE frames are
 *   skipped rather than thrown.
 */
export async function* parseAguiEventStream(response: Response): AsyncGenerator<AguiEvent> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        const dataLines = rawEvent
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart());
        if (dataLines.length === 0) continue;

        const data = dataLines.join('\n');
        if (!data) continue;

        try {
          yield JSON.parse(data) as AguiEvent;
        } catch {
          // Malformed/partial SSE frame — skip rather than throw, matching
          // SSE's own tolerant-parsing convention.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
