import { EventType } from '@ag-ui/core';
import { randomUUID } from 'crypto';
import { flattenErrors, formatRuntimeError } from './errors.js';
import { extractToolOutputContent, buildToolCompletionNotice } from './formatters.js';
import {
  extractStreamInterrupts,
  describeInterrupt,
  buildInterruptNotice,
  extractGraphInterrupts,
  isInterruptError,
  buildClarificationCustomEvent,
} from './interrupts.js';
import { buildFilesTodosSnapshot } from './snapshot.js';

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
 * @param {Function} [opts.getState]        async () => graph state `.values`. When
 *                                          provided, a STATE_SNAPSHOT of the virtual
 *                                          filesystem + todos is emitted at the end of
 *                                          the turn (and on interrupt) so the client can
 *                                          mirror files the agent created.
 * @returns {AsyncGenerator} AG-UI events.
 */
export async function* translateLangGraphStream(stream, opts = {}) {
  const { providerConfig, onInterrupt, onError, logger, getState } = opts;

  // Read authoritative graph state and emit a STATE_SNAPSHOT of { files, todos }.
  // Never throws — a state-read failure must not abort the event stream.
  async function* emitStateSnapshot(phase) {
    if (typeof getState !== 'function') return;
    try {
      const values = await getState();
      const snapshot = buildFilesTodosSnapshot(values);
      logger?.debug('[AG-UI] state snapshot', {
        phase,
        fileCount: Object.keys(snapshot.files).length,
        todoCount: snapshot.todos.length,
      });
      yield { type: EventType.STATE_SNAPSHOT, snapshot };
    } catch (stateErr) {
      logger?.debug('[AG-UI] state snapshot skipped', { phase, error: stateErr?.message });
    }
  }

  // Current contiguous assistant-text message id. Reset to null when a tool call
  // starts so post-tool text becomes a new message (there is a tool call between).
  let textMsgId = null;
  // run_id -> { name } for tool calls we surfaced, so we can match their results.
  const pendingToolCalls = new Map();
  // Lightweight tally for an end-of-stream summary log.
  const stats = { textChunks: 0, toolCalls: 0, toolResults: 0 };
  let textSinceLastToolResult = true;
  let lastToolResult = null;
  let streamInterrupts = null;

  logger?.debug('[AG-UI] stream translation started');

  try {
    for await (const event of stream) {
      const eventInterrupts = extractStreamInterrupts(event?.data);
      if (eventInterrupts) {
        streamInterrupts = eventInterrupts;
        break;
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
          textSinceLastToolResult = true;
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
        if (event.name === 'ask_clarification') {
          logger?.debug('[AG-UI] hiding clarification tool trace');
          continue;
        }

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
        if (event.name === 'ask_clarification') {
          logger?.debug('[AG-UI] hiding clarification tool result');
          continue;
        }

        const tc = pendingToolCalls.get(event.run_id);
        if (tc) {
          pendingToolCalls.delete(event.run_id);
          const resultContent = extractToolOutputContent(event.data?.output);
          stats.toolResults += 1;
          textSinceLastToolResult = false;
          lastToolResult = { name: tc.name, content: resultContent };
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
    if (streamInterrupts) {
      const interruptInfo = describeInterrupt(streamInterrupts);
      logger?.info('[AG-UI] stream paused at interrupt payload (awaiting user input)', {
        ...stats,
        kind: interruptInfo.kind,
        actionCount: interruptInfo.actionCount,
      });
      if (onInterrupt) onInterrupt(interruptInfo);
      if (interruptInfo.kind === 'hitl') {
        yield {
          type: EventType.CUSTOM,
          name: 'hitl_request',
          value: {
            actionRequests: interruptInfo.actionRequests,
            reviewConfigs: interruptInfo.reviewConfigs,
          },
        };
      } else {
        const customEvent = buildClarificationCustomEvent(interruptInfo);
        if (customEvent) yield customEvent;
      }

      // Always yield a readable text notice for the transcript, even if a custom card is shown.
      // This ensures tests pass and provide a fallback if the custom card isn't rendered.
      yield {
        type: EventType.TEXT_MESSAGE_CHUNK,
        messageId: randomUUID(),
        role: 'assistant',
        delta: buildInterruptNotice(streamInterrupts),
      };
      yield* emitStateSnapshot('interrupt');
      return;
    }

    if (lastToolResult && !textSinceLastToolResult) {
      const delta = buildToolCompletionNotice(lastToolResult.name, lastToolResult.content);
      logger?.debug('[AG-UI] synthesized post-tool completion notice', {
        name: lastToolResult.name,
      });
      yield {
        type: EventType.TEXT_MESSAGE_CHUNK,
        messageId: randomUUID(),
        role: 'assistant',
        delta,
      };
    }
    logger?.info('[AG-UI] stream finished', stats);
    // Mirror the virtual filesystem + plan to the client once the turn settles.
    yield* emitStateSnapshot('finished');
  } catch (err) {
    const graphInterrupts = extractGraphInterrupts(err);
    const interrupt = isInterruptError(err, graphInterrupts);

    let notice;
    if (interrupt) {
      const interruptInfo = describeInterrupt(graphInterrupts, err);
      logger?.info('[AG-UI] stream paused at interrupt (awaiting user input)', {
        ...stats,
        kind: interruptInfo.kind,
        actionCount: interruptInfo.actionCount,
      });
      if (onInterrupt) onInterrupt(interruptInfo);
      // Surface HITL approval requests as a structured event so the client can
      // render approve/reject controls with the pending tool calls.
      if (interruptInfo.kind === 'hitl') {
        yield {
          type: EventType.CUSTOM,
          name: 'hitl_request',
          value: {
            actionRequests: interruptInfo.actionRequests,
            reviewConfigs: interruptInfo.reviewConfigs,
          },
        };
      } else {
        const customEvent = buildClarificationCustomEvent(interruptInfo);
        if (customEvent) yield customEvent;
      }
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

    // On an interrupt the agent may already have written files/todos before pausing
    // (e.g. wrote a draft, then asked for clarification) — surface them now. We skip
    // this for genuine errors, where the state may be mid-write / inconsistent.
    if (interrupt) yield* emitStateSnapshot('interrupt');
  }
}
