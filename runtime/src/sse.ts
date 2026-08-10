import { EventType, type AguiEvent } from '@personaai/sdk';
import type { RunContext, RunResult, RuntimeHooks } from './types/hooks.js';
import { mapErrorToRuntimeError } from './errors.js';

/**
 * Serializes one AG-UI event back out as an SSE frame — matches
 * `@personaai/sdk`'s own inbound `parseAguiEventStream` format byte-for-byte
 * (`data: <json>\n\n`, no `event:`/`id:` line), so a consumer using this SDK
 * to read the runtime's output round-trips cleanly.
 */
export function formatSseFrame(event: AguiEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** A sanitized in-band RUN_ERROR frame for a failure that happens mid-stream, after headers are already committed. */
export function runErrorFrame(err: unknown, mode: 'development' | 'production'): string {
  const mapped = mapErrorToRuntimeError(err, mode);
  return formatSseFrame({
    type: EventType.RUN_ERROR,
    code: mapped.code,
    message: mapped.message,
  } as AguiEvent);
}

function accumulate(
  event: AguiEvent,
  acc: { text: string; interrupted: boolean; erroredInBand: boolean }
): void {
  const type = (event as { type: string }).type;
  if (type === EventType.TEXT_MESSAGE_CHUNK) {
    const delta = (event as { delta?: string }).delta;
    if (typeof delta === 'string') acc.text += delta;
  } else if (type === EventType.CUSTOM) {
    const name = (event as { name?: string }).name;
    if (name === 'hitl_request' || name === 'clarification_request') acc.interrupted = true;
  } else if (type === EventType.RUN_ERROR) {
    acc.erroredInBand = true;
  }
}

/**
 * The async generator an adapter actually drains. Firing `afterRun` here
 * (rather than after the top-level `for await` in the route handler) means
 * it only runs once the stream has genuinely been sent to completion —
 * the correct semantic for "after a run completes" when completion is
 * defined by the last SSE frame going out.
 */
export async function* chatEventsToSseBody(
  first: AguiEvent,
  rest: AsyncGenerator<AguiEvent>,
  runCtx: RunContext,
  hooks: RuntimeHooks | undefined,
  mode: 'development' | 'production'
): AsyncGenerator<string> {
  const acc = { text: '', interrupted: false, erroredInBand: false };
  let count = 0;

  try {
    accumulate(first, acc);
    count += 1;
    yield formatSseFrame(first);

    for await (const event of rest) {
      accumulate(event, acc);
      count += 1;
      yield formatSseFrame(event);
    }

    const result: RunResult = {
      text: acc.text,
      eventCount: count,
      interrupted: acc.interrupted,
      erroredInBand: acc.erroredInBand,
    };
    await hooks?.afterRun?.(runCtx, result);
  } catch (err) {
    // Headers (200, text/event-stream) are already committed — can't change
    // status now, so the failure surfaces as an in-band RUN_ERROR frame.
    await hooks?.onError?.(
      { userId: runCtx.userId, phase: 'chat', agentId: runCtx.agentId, threadId: runCtx.threadId },
      err
    );
    yield runErrorFrame(err, mode);
  }
}
