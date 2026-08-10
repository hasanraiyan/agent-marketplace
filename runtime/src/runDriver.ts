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

/** Applies one event's effect on the running accumulator and fires any lifecycle hooks it triggers. */
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

type FrameListener = (seq: number, frame: string) => void;
type DoneListener = () => void;

/**
 * Owns pumping one chat run's AG-UI events out of `@personaai/sdk`,
 * independent of any single HTTP response. Created once per run and kept
 * running (buffering every formatted SSE frame, with a sequence number)
 * regardless of whether the original request's connection is still
 * attached — this is what makes reconnect possible: a later request can
 * `subscribe()` to the SAME driver, replay the frames it missed, and pick
 * up the live tail.
 *
 * Lifecycle hooks (`beforeRun` is fired by the caller before construction;
 * everything else) fire exactly once here, regardless of how many
 * subscribers ever attach — never once per subscriber.
 */
export class RunDriver {
  readonly runId: string;
  readonly runCtx: RunContext;
  createdAt = Date.now();
  finishedAt: number | undefined;

  private frames: string[] = [];
  private listeners = new Set<FrameListener>();
  private doneListeners = new Set<DoneListener>();
  private finished = false;
  private firstFrameSettled = false;
  private firstFramePromise: Promise<void>;
  private resolveFirstFrame!: () => void;
  private rejectFirstFrame!: (err: unknown) => void;

  constructor(
    runId: string,
    runCtx: RunContext,
    source: AsyncGenerator<AguiEvent>,
    hooks: RuntimeHooks | undefined,
    mode: 'development' | 'production'
  ) {
    this.runId = runId;
    this.runCtx = runCtx;
    this.firstFramePromise = new Promise((resolve, reject) => {
      this.resolveFirstFrame = resolve;
      this.rejectFirstFrame = reject;
    });
    void this.pump(source, hooks, mode);
  }

  private push(frame: string): void {
    const seq = this.frames.length;
    this.frames.push(frame);
    for (const listener of this.listeners) listener(seq, frame);
    if (!this.firstFrameSettled) {
      this.firstFrameSettled = true;
      this.resolveFirstFrame();
    }
  }

  private finish(): void {
    this.finished = true;
    this.finishedAt = Date.now();
    for (const listener of this.doneListeners) listener();
  }

  private async pump(
    source: AsyncGenerator<AguiEvent>,
    hooks: RuntimeHooks | undefined,
    mode: 'development' | 'production'
  ): Promise<void> {
    const acc = newAccumulator();
    let count = 0;

    try {
      for await (const event of source) {
        await processEvent(event, acc, this.runCtx, hooks);
        count += 1;
        this.push(formatSseFrame(event));
      }

      if (!this.firstFrameSettled) {
        // The upstream stream completed successfully but produced zero
        // events — a valid empty run, not an error. Resolve rather than
        // leaving `waitForFirstFrame()` hanging forever.
        this.firstFrameSettled = true;
        this.resolveFirstFrame();
      }

      const result: RunResult = {
        text: acc.text,
        eventCount: count,
        interrupted: acc.interrupted,
        erroredInBand: acc.erroredInBand,
      };
      await hooks?.afterRun?.(this.runCtx, result);
    } catch (err) {
      await hooks?.onError?.(
        {
          userId: this.runCtx.userId,
          phase: 'chat',
          agentId: this.runCtx.agentId,
          threadId: this.runCtx.threadId,
        },
        err
      );

      if (!this.firstFrameSettled) {
        // Nothing was ever buffered — the very first upstream call failed
        // (auth/validation/network). The caller hasn't committed to a
        // streaming response yet and can still return a clean buffered
        // error instead.
        this.firstFrameSettled = true;
        this.rejectFirstFrame(err);
        return;
      }
      // Headers are already committed for every existing/future
      // subscriber — surface the failure as an in-band RUN_ERROR frame.
      this.push(runErrorFrame(err, mode));
    } finally {
      this.finish();
    }
  }

  /** Resolves once the first frame has been buffered, or rejects if the run failed before producing any frame at all. */
  waitForFirstFrame(): Promise<void> {
    return this.firstFramePromise;
  }

  isFinished(): boolean {
    return this.finished;
  }

  /** Total frames buffered so far — also the highest valid `since` a caller can request without missing anything. */
  get frameCount(): number {
    return this.frames.length;
  }

  /** Number of currently-live subscriptions (each `subscribe()` iterator that's been started but not yet exhausted/torn down). Exposed for tests verifying subscriptions clean up after themselves. */
  get subscriberCount(): number {
    return this.listeners.size;
  }

  /**
   * An async iterable that replays every buffered frame after `sinceSeq`
   * (`-1` for "from the start"), then continues yielding new frames live
   * as the run produces them, until the run finishes. Each call returns an
   * independent subscription — multiple concurrent subscribers (e.g. the
   * original connection plus a reconnect that raced it) are supported.
   */
  subscribe(sinceSeq: number): AsyncIterable<string> {
    const buffered = this.frames.slice(Math.max(sinceSeq + 1, 0));
    const finishedAtSubscribeTime = this.finished;
    const listeners = this.listeners;
    const doneListeners = this.doneListeners;

    return {
      [Symbol.asyncIterator](): AsyncIterator<string> {
        const queue: string[] = [...buffered];
        let live = !finishedAtSubscribeTime;
        let wake: (() => void) | null = null;

        const onFrame: FrameListener = (_seq, frame) => {
          queue.push(frame);
          wake?.();
        };
        const onDone: DoneListener = () => {
          live = false;
          wake?.();
        };

        if (live) {
          listeners.add(onFrame);
          doneListeners.add(onDone);
        }

        const cleanup = () => {
          listeners.delete(onFrame);
          doneListeners.delete(onDone);
        };

        return {
          async next(): Promise<IteratorResult<string>> {
            for (;;) {
              if (queue.length > 0) return { done: false, value: queue.shift()! };
              if (!live) {
                cleanup();
                return { done: true, value: undefined };
              }
              await new Promise<void>((resolve) => (wake = resolve));
            }
          },
          async return(): Promise<IteratorResult<string>> {
            cleanup();
            return { done: true, value: undefined };
          },
        };
      },
    };
  }
}
