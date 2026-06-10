import { EventType } from '@ag-ui/core';
import { randomUUID } from 'crypto';

/**
 * Translates a LangGraph `streamEvents(..., { version: 'v2' })` async iterator into
 * the AG-UI event stream that the custom web/mobile clients consume.
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

function extractStreamInterrupts(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value.__interrupt__) && value.__interrupt__.length > 0) {
    return value.__interrupt__;
  }

  if (Array.isArray(value.interrupts) && value.interrupts.length > 0) {
    return value.interrupts;
  }

  for (const child of Object.values(value)) {
    const found = extractStreamInterrupts(child, seen);
    if (found) return found;
  }

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
// rather than a genuine failure.
export function isInterruptError(err, graphInterrupts) {
  return (
    (graphInterrupts ?? extractGraphInterrupts(err)) != null ||
    err?.name === 'GraphInterrupt' ||
    Boolean(err?.message?.toLowerCase().includes('interrupt'))
  );
}

export function normalizeClarificationQuestions(graphInterrupts, err) {
  const interruptValue = (graphInterrupts ?? err?.interrupts)?.[0]?.value;
  const rawQuestions = Array.isArray(interruptValue?.questions) ? interruptValue.questions : [];

  return rawQuestions
    .map((question, index) => {
      const text = typeof question?.text === 'string' ? question.text.trim() : '';
      if (!text) return null;
      const options = Array.isArray(question.options)
        ? question.options
            .map((option) => (typeof option === 'string' ? option.trim() : ''))
            .filter(Boolean)
        : [];

      return {
        id:
          typeof question.id === 'string' && question.id.trim()
            ? question.id.trim()
            : `question_${index + 1}`,
        text,
        options,
        required: question.required !== false,
        allowCustom: question.allowCustom !== false,
      };
    })
    .filter(Boolean);
}

// Classify the first interrupt payload of a paused run. HITL interrupts come from
// langchain's humanInTheLoopMiddleware (interruptOn) and carry actionRequests +
// reviewConfigs; they must be resumed with `{ decisions: [...] }`. Other interrupt
// payloads resume with raw user text.
export function describeInterrupt(graphInterrupts, err) {
  const interruptValue = (graphInterrupts ?? err?.interrupts)?.[0]?.value;
  const actionRequests = interruptValue?.actionRequests;

  if (Array.isArray(actionRequests) && actionRequests.length > 0) {
    return {
      kind: 'hitl',
      actionCount: actionRequests.length,
      actionRequests,
      reviewConfigs: Array.isArray(interruptValue?.reviewConfigs)
        ? interruptValue.reviewConfigs
        : [],
    };
  }
  return {
    kind: 'clarification',
    actionCount: 0,
    questions: normalizeClarificationQuestions(graphInterrupts, err),
  };
}

// Build the value passed to Command({ resume }) when a paused thread receives the
// next client request. HITL interrupts (interruptOn tool approval) must resume with
// `{ decisions: [...] }`: structured decisions from the client are forwarded as-is,
// and a plain text reply is translated into reject-with-feedback so the model
// re-plans with the user's message. Clarification interrupts resume with raw text.
export function buildResumeValue(pendingInterrupt, resume, content) {
  if (pendingInterrupt?.kind !== 'hitl') {
    if (Array.isArray(resume?.answers) && resume.answers.length > 0) {
      return {
        answers: resume.answers,
        text: typeof resume.text === 'string' ? resume.text : content,
      };
    }
    return content;
  }

  if (Array.isArray(resume?.decisions) && resume.decisions.length > 0) {
    return { decisions: resume.decisions };
  }

  const actionCount = pendingInterrupt.actionCount || 1;
  return {
    decisions: Array.from({ length: actionCount }, () => ({
      type: 'reject',
      message: content || 'User declined the action.',
    })),
  };
}

// Build the user-facing prompt shown when the graph pauses at an interrupt. If the
// interrupt carried structured questions/options, render them as a numbered list.
export function buildInterruptNotice(graphInterrupts, err) {
  const interruptValue = (graphInterrupts ?? err?.interrupts)?.[0]?.value;
  const actionRequests = interruptValue?.actionRequests;
  if (Array.isArray(actionRequests) && actionRequests.length > 0) {
    const lines = actionRequests.map((action, i) => `**${i + 1}. ${action?.name || 'tool'}**`);
    return (
      `I'd like to run the following ${actionRequests.length > 1 ? 'actions' : 'action'} and need your approval:\n\n` +
      `${lines.join('\n')}\n\n` +
      `Approve to continue, or reply with feedback and I'll adjust.`
    );
  }

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

// Extract the displayable string content of a tool's on_tool_end output.
//
// LangChain wraps a tool's return value in a ToolMessage whenever the call has a
// tool_call_id and the value isn't already a plain string (see core's
// _formatToolOutput). So when a tool returns an OBJECT (e.g. search_web's Tavily
// `{ query, results }`), event.data.output is a ToolMessage *instance* — and
// JSON.stringify(message) serializes LangChain's envelope
// (`{lc,type,id,kwargs:{content:"<the real payload>"}}`), burying the real result
// in kwargs.content. Unwrap to `.content` so the client receives the actual tool
// output (the JSON string / text), not the serialization envelope.
export function extractToolOutputContent(output) {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  // ToolMessage / BaseMessage: the payload lives on `.content`.
  if (typeof output.content === 'string') return output.content;
  if (Array.isArray(output.content)) {
    // Content blocks: concatenate text parts, stringify anything else.
    return output.content
      .map((b) => (typeof b === 'string' ? b : (b?.text ?? JSON.stringify(b))))
      .join('');
  }
  // Plain object (a tool that returned a raw object with no tool_call_id wrapping):
  // serialize it as before.
  return JSON.stringify(output ?? '');
}

function buildToolCompletionNotice(toolName, resultContent) {
  const prettyName = String(toolName || 'tool')
    .split(/[_\-\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  let parsed = null;
  if (typeof resultContent === 'string' && resultContent.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(resultContent);
    } catch {
      parsed = null;
    }
  }

  if (parsed?.status === 'error') {
    return `The ${prettyName} tool finished with an error: ${parsed.message || 'Unknown error'}`;
  }

  if (parsed?.status === 'success' && parsed?.message) {
    return `${parsed.message}`;
  }

  return `${prettyName} completed.`;
}

function buildClarificationCustomEvent(interruptInfo) {
  if (interruptInfo.kind !== 'clarification' || interruptInfo.questions.length === 0) return null;
  return {
    type: EventType.CUSTOM,
    name: 'clarification_request',
    value: {
      questions: interruptInfo.questions,
      currentIndex: 0,
    },
  };
}

// One-shot assistant text message (used for pre-stream errors: missing agent,
// build failure). Emitted as a single chunk; the runtime closes it at RUN_FINISHED.
export async function* emitTextNotice(delta) {
  yield { type: EventType.TEXT_MESSAGE_CHUNK, messageId: randomUUID(), role: 'assistant', delta };
}

// deepagents StateBackend stores each file's body as an array of lines (it splits
// on '\n' when writing); it can also be a plain string, or a Uint8Array for binary
// writes. Normalize to a single display string. Binary content is not surfaced as
// text — the panel can still show its existence/size.
function normalizeFileContent(data) {
  const body = data && typeof data === 'object' && 'content' in data ? data.content : data;
  if (Array.isArray(body)) return body.join('\n');
  if (typeof body === 'string') return body;
  return '';
}

/**
 * Build the AG-UI state payload mirrored to the client (the virtual filesystem +
 * the live plan). Reads the graph's persisted channel values (`getState().values`)
 * and shapes them for the Files panel / todo checklist.
 *
 * System-seeded skill files (`/skills/...`) are excluded — they are injected by the
 * factory, not artifacts the agent produced, so they would only be noise.
 *
 * @param {object} stateValues  LangGraph state snapshot `.values` ({ files, todos, ... }).
 * @returns {{ files: object, todos: Array }} normalized snapshot.
 */
export function buildFilesTodosSnapshot(stateValues) {
  const files = {};
  const rawFiles = stateValues?.files;
  if (rawFiles && typeof rawFiles === 'object') {
    for (const [path, data] of Object.entries(rawFiles)) {
      if (typeof path !== 'string' || path.startsWith('/skills/')) continue;
      const content = normalizeFileContent(data);
      files[path] = {
        content,
        size: content.length,
        created_at: data?.created_at ?? data?.createdAt ?? null,
        modified_at: data?.modified_at ?? data?.modifiedAt ?? null,
      };
    }
  }

  const todos = Array.isArray(stateValues?.todos)
    ? stateValues.todos.map((t) => ({
        content: typeof t?.content === 'string' ? t.content : '',
        status: typeof t?.status === 'string' ? t.status : 'pending',
      }))
    : [];

  return { files, todos };
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
      if (Object.keys(snapshot.files).length === 0 && snapshot.todos.length === 0) return;
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
