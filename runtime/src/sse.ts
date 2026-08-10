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

interface Accumulator {
  text: string;
  interrupted: boolean;
  erroredInBand: boolean;
  threadCreateFired: boolean;
  /** toolCallId -> toolCallName, learned from TOOL_CALL_START, so TOOL_CALL_RESULT can report a name. */
  toolNames: Map<string, string>;
}

function newAccumulator(): Accumulator {
  return {
    text: '',
    interrupted: false,
    erroredInBand: false,
    threadCreateFired: false,
    toolNames: new Map(),
  };
}

/**
 * Applies one event's effect on the running accumulator and fires any
 * lifecycle hooks it triggers. Shared between the peeked first event and
 * every subsequent one, since the peek-before-commit design in
 * `routes/chat.ts` means the first event never flows through the same
 * `for await` loop as the rest.
 */
async function processEvent(
  event: AguiEvent,
  acc: Accumulator,
  runCtx: RunContext,
  hooks: RuntimeHooks | undefined
): Promise<void> {
  const e = event as Record<string, unknown> & { type: string };

  switch (e.type) {
    case EventType.RUN_STARTED: {
      const threadId = typeof e.threadId === 'string' ? e.threadId : undefined;
      // No threadId was supplied on the way in, but the run reports one —
      // that means Persona created it implicitly for this turn.
      if (!acc.threadCreateFired && !runCtx.threadId && threadId) {
        acc.threadCreateFired = true;
        await hooks?.onThreadCreate?.({ userId: runCtx.userId, agentId: runCtx.agentId, threadId });
      }
      break;
    }
    case EventType.TEXT_MESSAGE_CHUNK: {
      const delta = e.delta;
      if (typeof delta === 'string') acc.text += delta;
      break;
    }
    case EventType.CUSTOM: {
      if (e.name === 'hitl_request' || e.name === 'clarification_request') acc.interrupted = true;
      break;
    }
    case EventType.RUN_ERROR: {
      acc.erroredInBand = true;
      break;
    }
    case EventType.TOOL_CALL_START: {
      const toolCallId = typeof e.toolCallId === 'string' ? e.toolCallId : undefined;
      const toolCallName = typeof e.toolCallName === 'string' ? e.toolCallName : 'unknown_tool';
      if (toolCallId) {
        acc.toolNames.set(toolCallId, toolCallName);
        await hooks?.beforeToolCall?.({
          userId: runCtx.userId,
          agentId: runCtx.agentId,
          threadId: runCtx.threadId,
          toolName: toolCallName,
          toolCallId,
        });
      }
      break;
    }
    case EventType.TOOL_CALL_RESULT: {
      const toolCallId = typeof e.toolCallId === 'string' ? e.toolCallId : undefined;
      if (toolCallId) {
        await hooks?.afterToolCall?.(
          {
            userId: runCtx.userId,
            agentId: runCtx.agentId,
            threadId: runCtx.threadId,
            toolName: acc.toolNames.get(toolCallId) ?? 'unknown_tool',
            toolCallId,
          },
          e.content
        );
      }
      break;
    }
    default:
      break;
  }
}

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
 * The async generator an adapter actually drains. Firing `afterRun` here
 * (rather than after the top-level `for await` in the route handler) means
 * it only runs once the stream has genuinely been sent to completion —
 * the correct semantic for "after a run completes" when completion is
 * defined by the last SSE frame going out.
 *
 * Interleaves `HEARTBEAT_FRAME`s during any gap between real events (e.g. a
 * long-running tool call with no token output) without breaking pull-based
 * backpressure: `rest.next()` is only ever called once per real event — a
 * heartbeat firing just re-races the *same* pending `next()` promise against
 * a fresh timer, it never issues an extra `next()` call ahead of what the
 * consumer has actually asked for.
 */
export async function* chatEventsToSseBody(
  first: AguiEvent,
  rest: AsyncGenerator<AguiEvent>,
  runCtx: RunContext,
  hooks: RuntimeHooks | undefined,
  mode: 'development' | 'production',
  heartbeatIntervalMs = 15000
): AsyncGenerator<string> {
  const acc = newAccumulator();
  let count = 0;

  try {
    await processEvent(first, acc, runCtx, hooks);
    count += 1;
    yield formatSseFrame(first);

    let pending: Promise<IteratorResult<AguiEvent>> | null = null;
    for (;;) {
      pending ??= rest.next();
      const timer = heartbeatTimer(heartbeatIntervalMs);
      const winner = await Promise.race([pending, timer.promise]);
      timer.cancel();

      if (winner === TIMEOUT) {
        yield HEARTBEAT_FRAME;
        continue; // re-race the same pending next() call, no extra pull
      }

      pending = null;
      if (winner.done) break;
      await processEvent(winner.value, acc, runCtx, hooks);
      count += 1;
      yield formatSseFrame(winner.value);
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
