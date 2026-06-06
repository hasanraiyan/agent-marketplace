import { EventType } from '@ag-ui/core';
import { randomUUID } from 'crypto';

/**
 * Translates a LangGraph `streamEvents(..., { version: 'v2' })` async iterator into
 * the AG-UI event stream that CopilotKit's runtime expects.
 *
 * Why this exists: there is no in-process LangGraph -> AG-UI adapter for Node. The
 * TypeScript `@ag-ui/langgraph` agents (LangGraphAgent / LangGraphHttpAgent) only talk
 * to a *deployed* LangGraph Platform/server over HTTP; the in-process path
 * (`add_langgraph_fastapi_endpoint`) is Python-only. Our agents are built in-process and
 * per-request (per-user model/provider/tools/skills), so we translate the graph's event
 * stream ourselves — this module is the JS equivalent of that Python helper.
 *
 * It emits AG-UI *chunk* events (`TEXT_MESSAGE_CHUNK`, `TOOL_CALL_CHUNK`), which the
 * client's transformChunks pipeline auto-expands into START/CONTENT/END triads. Chunks
 * remove the manual open/close bookkeeping that previously emitted a `parentMessageId:
 * null` on TOOL_CALL_START — an explicit null fails `@ag-ui/core`'s `z.string().optional()`
 * and aborted the whole stream. TOOL_CALL_CHUNK has no required parentMessageId, so that
 * entire bug class is structurally gone.
 */

// Recursively find LangGraph interrupt payloads from a GraphInterrupt or an
// AggregateError (which wraps GraphInterrupt on err.errors[N].interrupts).
export function extractGraphInterrupts(err) {
  if (!err) return null;
  if (Array.isArray(err.interrupts) && err.interrupts.length > 0) return err.interrupts;
  if (Array.isArray(err.errors)) {
    for (const inner of err.errors) {
      const found = extractGraphInterrupts(inner);
      if (found) return found;
    }
  }
  if (err.cause) return extractGraphInterrupts(err.cause);
  return null;
}

// LangGraph throws an AggregateError ("Multiple errors occurred during superstep N")
// when 2+ parallel tasks fail in the same step — the real causes live in err.errors[],
// not err.message. Flatten the whole tree (AggregateError.errors + .cause) into the
// individual leaf errors so they can be logged and surfaced.
export function flattenErrors(err, seen = new Set()) {
  if (!err || seen.has(err)) return [];
  seen.add(err);
  const leaves = [];
  const children = [
    ...(Array.isArray(err.errors) ? err.errors : []),
    ...(err.cause ? [err.cause] : []),
  ];
  if (children.length === 0) {
    leaves.push(err);
  } else {
    for (const child of children) leaves.push(...flattenErrors(child, seen));
  }
  return leaves;
}

export function formatRuntimeError(err, providerConfig) {
  const rawMessage = err?.message || 'Unknown error';
  const lower = rawMessage.toLowerCase();

  const isProviderAuthIssue =
    lower.includes('incorrect api key provided') ||
    lower.includes('model_authentication') ||
    (lower.includes('401') && lower.includes('api key'));

  if (isProviderAuthIssue) {
    const providerLabel = providerConfig?.label || 'this provider';
    return `Provider "${providerLabel}" has invalid credentials. Update its API key in Settings and try again.`;
  }

  return rawMessage;
}

// Determine whether a thrown error is actually a human-in-the-loop interrupt
// (ask_clarification etc.) rather than a genuine failure.
export function isInterruptError(err, graphInterrupts) {
  return (
    (graphInterrupts ?? extractGraphInterrupts(err)) != null ||
    err?.name === 'GraphInterrupt' ||
    Boolean(err?.message?.toLowerCase().includes('interrupt'))
  );
}

// Build the user-facing prompt shown when the graph pauses at an interrupt. If the
// interrupt carried structured questions/options, render them as a numbered list.
export function buildInterruptNotice(graphInterrupts, err) {
  const interruptValue = (graphInterrupts ?? err?.interrupts)?.[0]?.value;
  const questions = interruptValue?.questions;

  if (Array.isArray(questions) && questions.length > 0) {
    const lines = questions.map((q, i) => {
      const opts = (q.options || [])
        .map((o, j) => `  ${String.fromCharCode(97 + j)}) ${o}`)
        .join('\n');
      return `**${i + 1}. ${q.text}**${opts ? '\n' + opts : ''}`;
    });
    return (
      `I need a bit more information before I continue:\n\n${lines.join('\n\n')}\n\n` +
      `Reply with your answer and I'll pick up right where I left off.`
    );
  }
  return 'I need your input to continue. Please reply with your answer.';
}

// One-shot assistant text message (used for pre-stream errors: missing agent,
// build failure). Emitted as a single chunk; the runtime closes it at RUN_FINISHED.
export async function* emitTextNotice(delta) {
  yield { type: EventType.TEXT_MESSAGE_CHUNK, messageId: randomUUID(), role: 'assistant', delta };
}

/**
 * @param {AsyncIterable} stream  LangGraph streamEvents iterator (version: 'v2').
 * @param {object}   opts
 * @param {object}   [opts.providerConfig]  for friendlier provider-auth error text.
 * @param {Function} [opts.onInterrupt]     called when an HITL interrupt is detected,
 *                                          so the caller can mark the thread for resume.
 * @param {Function} [opts.onError]         called with (leafErrors, originalErr) for a
 *                                          genuine failure, so the caller can log.
 * @param {object}   [opts.logger]          logger with .debug/.info; logs stream
 *                                          lifecycle, tool calls, interrupts.
 * @returns {AsyncGenerator} AG-UI events.
 */
export async function* translateLangGraphStream(stream, opts = {}) {
  const { providerConfig, onInterrupt, onError, logger } = opts;

  // Current contiguous assistant-text message id. Reset to null when a tool call
  // starts so post-tool text becomes a new message (there is a tool call between).
  let textMsgId = null;
  // run_id -> { name } for tool calls we surfaced, so we can match their results.
  const pendingToolCalls = new Map();
  // Lightweight tally for an end-of-stream summary log.
  const stats = { textChunks: 0, toolCalls: 0, toolResults: 0 };
  // Track last seen state to emit deltas
  let lastState = { files: {}, todos: [] };

  logger?.debug('[AG-UI] stream translation started');

  try {
    for await (const event of stream) {
      // ── State snapshot ───────────────────────────────────────────────────
      // On every step, check if files or todos changed and emit a state event.
      // This powers the frontend artifact/file panel.
      if (event.event === 'on_chain_end' && event.name === 'LangGraph') {
        const state = event.data?.output;
        if (state) {
          const files = state.files || {};
          const todos = state.todos || [];

          // Simple check for changes
          const filesChanged = JSON.stringify(files) !== JSON.stringify(lastState.files);
          const todosChanged = JSON.stringify(todos) !== JSON.stringify(lastState.todos);

          if (filesChanged || todosChanged) {
            lastState = { files, todos };
            yield {
              type: 'STATE_SNAPSHOT',
              state: { files, todos },
            };
          }
        }
      }

      // ── Streamed assistant text ──────────────────────────────────────────────
      if (event.event === 'on_chat_model_stream') {
        const text = typeof event.data?.chunk?.content === 'string' ? event.data.chunk.content : '';
        if (text) {
          if (!textMsgId) {
            textMsgId = randomUUID();
            logger?.debug('[AG-UI] assistant text started', { messageId: textMsgId });
          }
          stats.textChunks += 1;
          yield {
            type: EventType.TEXT_MESSAGE_CHUNK,
            messageId: textMsgId,
            role: 'assistant',
            delta: text,
          };
        }
      }

      // ── Tool call start ──────────────────────────────────────────────────────
      else if (event.event === 'on_tool_start') {
        // Skip internal sub-tool calls (e.g. TavilySearch invoked inside the
        // search_web wrapper). The model never called these, so surfacing AG-UI
        // tool events for them injects a tool-call id with no matching assistant
        // tool call and corrupts the message stream. Their on_tool_end is ignored
        // automatically (never added to pendingToolCalls).
        if (event.tags?.includes('internal:nested-tool')) {
          logger?.debug('[AG-UI] skipping internal nested tool', { name: event.name });
          continue;
        }

        // A tool call ends the current text grouping.
        textMsgId = null;

        const toolCallId = event.run_id;
        const toolName = event.name;
        const toolInput = event.data?.input;
        pendingToolCalls.set(toolCallId, { name: toolName });
        stats.toolCalls += 1;

        const argsStr = typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput ?? {});
        logger?.debug('[AG-UI] tool call', {
          name: toolName,
          toolCallId,
          argsLength: argsStr.length,
        });
        // TOOL_CALL_CHUNK carries id + name + args and needs no parentMessageId.
        yield {
          type: EventType.TOOL_CALL_CHUNK,
          toolCallId,
          toolCallName: toolName,
          delta: argsStr,
        };
      }

      // ── Tool call result ─────────────────────────────────────────────────────
      else if (event.event === 'on_tool_end') {
        const tc = pendingToolCalls.get(event.run_id);
        if (tc) {
          pendingToolCalls.delete(event.run_id);
          const output = event.data?.output;
          const resultContent = typeof output === 'string' ? output : JSON.stringify(output ?? '');
          stats.toolResults += 1;
          logger?.debug('[AG-UI] tool result', {
            name: tc.name,
            toolCallId: event.run_id,
            resultLength: resultContent.length,
          });
          yield {
            type: EventType.TOOL_CALL_RESULT,
            messageId: randomUUID(),
            toolCallId: event.run_id,
            content: resultContent,
            role: 'tool',
          };
        }
      }
    }
    logger?.info('[AG-UI] stream finished', stats);
  } catch (err) {
    const graphInterrupts = extractGraphInterrupts(err);
    const interrupt = isInterruptError(err, graphInterrupts);

    let notice;
    if (interrupt) {
      logger?.info('[AG-UI] stream paused at interrupt (awaiting user input)', stats);
      if (onInterrupt) onInterrupt();
      notice = buildInterruptNotice(graphInterrupts, err);
    } else {
      // Surface the REAL underlying failures. AggregateError ("Multiple errors
      // occurred during superstep N") hides the actual tool errors in err.errors[],
      // so flatten them for the caller to log, and show the first real cause.
      const leaves = flattenErrors(err);
      if (onError) onError(leaves, err);
      const rootCause = leaves.find((e) => e?.message) || err;
      notice = `\n\n*(Error: ${formatRuntimeError(rootCause, providerConfig)})*`;
    }

    yield {
      type: EventType.TEXT_MESSAGE_CHUNK,
      messageId: randomUUID(),
      role: 'assistant',
      delta: notice,
    };
  }
}
