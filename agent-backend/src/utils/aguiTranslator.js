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
  // A single text block returned as an object rather than an array -
  // @langchain/mcp-adapters does this when the MCP result also carries
  // structuredContent/_meta (it merges them onto the one text block: see
  // _convertCallToolResult in @langchain/mcp-adapters/dist/tools.js). Unwrap
  // `.text` here too, or this falls through to the envelope-stringify below.
  if (output.content && typeof output.content === 'object' && typeof output.content.text === 'string') {
    return output.content.text;
  }
  // Plain object (a tool that returned a raw object with no tool_call_id wrapping):
  // serialize it as before.
  return JSON.stringify(output ?? '');
}

// MCP tools that return `structuredContent` (declared via an outputSchema -
// used by MCP App widgets for their `ontoolresult`/`oncalltool` payloads)
// carry it on the ToolMessage's `.artifact`, not `.content`:
// @langchain/mcp-adapters' _convertCallToolResult pushes
// `{ type: "mcp_structured_content", data: structuredContent }` onto the
// artifact array for `responseFormat: "content_and_artifact"` tools (which is
// how loadMcpTools configures every MCP tool). extractToolOutputContent only
// reads `.content`, so without this it's silently dropped.
export function extractStructuredContent(output) {
  const artifact = output?.artifact;
  if (!Array.isArray(artifact)) return undefined;
  return artifact.find((item) => item?.type === 'mcp_structured_content')?.data;
}

// LangGraph's ToolNode already catches tool exceptions and feeds the model an
// error ToolMessage (see `defaultHandleToolErrors` in `langchain`'s ToolNode) —
// the run itself never crashes. But the *traced* tool.invoke() call still ends
// in on_tool_error rather than on_tool_end, so the AG-UI stream must read the
// failure off event.data.error (not event.data.output) to describe it.
export function extractToolErrorMessage(err) {
  if (!err) return 'Tool execution failed.';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message) return err.message;
  return String(err);
}

function buildToolErrorContent(err) {
  return JSON.stringify({ status: 'error', message: extractToolErrorMessage(err) });
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

// Model chunk content can be a plain string or an array of content blocks
// ({ type: 'text', text }). Normalize to the text delta.
export function extractTextDelta(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => {
      if (typeof block === 'string') return block;
      if (block?.type === 'text' && typeof block.text === 'string') return block.text;
      return '';
    })
    .join('');
}

// Reasoning deltas land in different places depending on the provider:
// OpenAI-compatible APIs (DeepSeek, OpenRouter, ...) use
// additional_kwargs.reasoning_content / .reasoning; block-content providers
// emit { type: 'reasoning' | 'thinking' } blocks.
export function extractReasoningDelta(chunk) {
  const kwargs = chunk?.additional_kwargs;
  if (typeof kwargs?.reasoning_content === 'string' && kwargs.reasoning_content) {
    return kwargs.reasoning_content;
  }
  if (typeof kwargs?.reasoning === 'string' && kwargs.reasoning) {
    return kwargs.reasoning;
  }
  const content = chunk?.content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => {
      if (!block || (block.type !== 'reasoning' && block.type !== 'thinking')) return '';
      if (typeof block.reasoning === 'string') return block.reasoning;
      if (typeof block.thinking === 'string') return block.thinking;
      if (typeof block.text === 'string') return block.text;
      return '';
    })
    .join('');
}

// Events from inside a subagent (deepagents `task` tool) carry a nested
// checkpoint namespace ("parent:id|child:id"); root-level nodes have a single
// segment. Used to keep subagent model tokens out of the main transcript.
function isNestedNamespace(event) {
  const ns = event?.metadata?.langgraph_checkpoint_ns ?? event?.metadata?.checkpoint_ns;
  return typeof ns === 'string' && ns.includes('|');
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
      // Filter out directory entries to avoid presenting them as empty files in the UI
      if (
        data?.is_dir === true ||
        data?.isDir === true ||
        data?.isDirectory === true ||
        data?.type === 'directory' ||
        path.endsWith('/')
      ) {
        continue;
      }
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
 * @param {string[]} [opts.suppressArgStreamingFor]  tool names whose args must NOT be
 *                                          streamed from the model's tool_call_chunks
 *                                          (HITL-guarded tools: the graph pauses before
 *                                          executing them, so a streamed card would be
 *                                          stranded in "running" across the interrupt).
 * @returns {AsyncGenerator} AG-UI events.
 */
export async function* translateLangGraphStream(stream, opts = {}) {
  const { providerConfig, onInterrupt, onError, logger, getState, mcpAppMap = {}, runScopeTracker } = opts;
  const suppressArgStreaming = new Set(opts.suppressArgStreamingFor || []);

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
  // Current open reasoning message id (REASONING_MESSAGE_START emitted, no END yet).
  let reasoningMsgId = null;
  // run_id -> { name, toolCallId } for tool calls we surfaced, so we can match
  // their results to the toolCallId the client saw (model id when args were
  // pre-streamed, run_id otherwise).
  const pendingToolCalls = new Map();
  // Args streamed live from the model's tool_call_chunks, keyed by chunk index
  // within the current model turn. A new id at a known index = a new turn.
  const toolArgStreams = new Map();
  // model tool_call id -> { name, args, bound }: streamed calls awaiting their
  // on_tool_start, so execution binds to the already-emitted toolCallId.
  const streamedToolCalls = new Map();
  // deepagents `task` (subagent) calls currently executing, newest last. Used
  // as the attribution fallback when run ancestry is unavailable.
  const taskToolStack = [];
  // task tool run_id -> the toolCallId the client saw for that task card.
  const taskRuns = new Map();

  // Resolve which running `task` call encloses `runId` by walking the run
  // ancestry recorded by RunScopeTracker. Returns null when ancestry is
  // unavailable or no task run is an ancestor.
  const findTaskAncestor = (runId) => {
    if (!runScopeTracker || !runId || taskRuns.size === 0) return null;
    const taskRunId = runScopeTracker.findAncestor(runId, (id) => taskRuns.has(id));
    return taskRunId ? { runId: taskRunId, toolCallId: taskRuns.get(taskRunId) } : null;
  };
  // Ancestry is authoritative; the newest-task stack is only a fallback. The
  // stack alone misattributes events when the model launches several
  // subagents in parallel (Promise.all interleaves their streams).
  const resolveHostTask = (runId) =>
    findTaskAncestor(runId) || taskToolStack[taskToolStack.length - 1];
  // run_id -> { name, toolCallId } for a subagent's internal tool calls. These
  // are surfaced as subagent_activity entries on the owning task card, NEVER as
  // top-level tool cards (that would make them look like the main agent's).
  const nestedToolRuns = new Map();
  // Tools currently executing (incl. hidden ones). While > 0, any model stream
  // belongs to a nested run — the main model never streams during its own tools.
  let runningToolDepth = 0;
  // run_ids with a processed on_tool_start awaiting their end. LangSmith
  // tracing (LANGCHAIN_TRACING_V2) makes subagent callbacks fire twice — a
  // run can only start/end once, so lifecycle events are deduped by run_id.
  // This also keeps runningToolDepth correct when deliveries are asymmetric
  // (an end with no matching start must not decrement the depth).
  const liveToolRuns = new Set();
  // Lightweight tally for an end-of-stream summary log.
  const stats = { textChunks: 0, reasoningChunks: 0, nestedChunks: 0, toolCalls: 0, toolResults: 0 };
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

      // ── Streamed model output (text / reasoning / tool-call args) ───────────
      if (event.event === 'on_chat_model_stream') {
        // Subagent models (deepagents `task` tool) stream through the same
        // iterator; interleaving their tokens would corrupt the main transcript.
        // Instead, surface them as live activity on the owning task tool card.
        if (runningToolDepth > 0 || isNestedNamespace(event)) {
          stats.nestedChunks += 1;
          const hostTask = resolveHostTask(event.run_id);
          if (hostTask) {
            const nestedText = extractTextDelta(event.data?.chunk?.content);
            if (nestedText) {
              yield {
                type: EventType.CUSTOM,
                name: 'subagent_activity',
                value: { toolCallId: hostTask.toolCallId, kind: 'text', delta: nestedText },
              };
            }
          }
          continue;
        }

        const chunk = event.data?.chunk;

        const reasoningDelta = extractReasoningDelta(chunk);
        if (reasoningDelta) {
          if (!reasoningMsgId) {
            reasoningMsgId = randomUUID();
            logger?.debug('[AG-UI] reasoning started', { messageId: reasoningMsgId });
            yield { type: EventType.REASONING_MESSAGE_START, messageId: reasoningMsgId };
          }
          stats.reasoningChunks += 1;
          yield {
            type: EventType.REASONING_MESSAGE_CONTENT,
            messageId: reasoningMsgId,
            delta: reasoningDelta,
          };
        }

        const text = extractTextDelta(chunk?.content);
        if (text) {
          if (reasoningMsgId) {
            reasoningMsgId = null;
            yield { type: EventType.REASONING_END };
          }
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

        // Stream tool-call args as the model generates them, so the tool card
        // appears the moment the model decides to call a tool instead of after
        // the full args finished AND execution began (on_tool_start).
        const tcChunks = Array.isArray(chunk?.tool_call_chunks) ? chunk.tool_call_chunks : [];
        for (const tc of tcChunks) {
          const index = typeof tc.index === 'number' ? tc.index : 0;
          let s = toolArgStreams.get(index);
          if (!s || (tc.id && s.id && tc.id !== s.id)) {
            s = { id: tc.id || null, name: tc.name || '', args: '', emitted: 0, opened: false, decided: false, emit: false };
            toolArgStreams.set(index, s);
          } else {
            if (tc.id && !s.id) s.id = tc.id;
            if (tc.name && !s.name) s.name = tc.name;
          }
          if (typeof tc.args === 'string') s.args += tc.args;

          // Decide once per call — needs both id and name (first chunk carries
          // them). Hidden and HITL-guarded tools fall back to on_tool_start.
          if (!s.decided && s.id && s.name) {
            s.decided = true;
            s.emit = s.name !== 'ask_clarification' && !suppressArgStreaming.has(s.name);
            if (s.emit) {
              streamedToolCalls.set(s.id, { name: s.name, args: '', bound: false });
              logger?.debug('[AG-UI] tool args streaming', { name: s.name, toolCallId: s.id });
              if (reasoningMsgId) {
                reasoningMsgId = null;
                yield { type: EventType.REASONING_END };
              }
              // A tool call ends the current text grouping.
              textMsgId = null;
            }
          }
          if (s.emit) {
            const pending = s.args.slice(s.emitted);
            // Emit the (possibly empty) first chunk immediately so the card
            // shows up as soon as the call starts.
            if (pending || !s.opened) {
              s.opened = true;
              s.emitted = s.args.length;
              streamedToolCalls.get(s.id).args = s.args;
              yield {
                type: EventType.TOOL_CALL_CHUNK,
                toolCallId: s.id,
                toolCallName: s.name,
                delta: pending,
              };
            }
          }
        }
      }

      // ── New top-level model turn ─────────────────────────────────────────────
      else if (event.event === 'on_chat_model_start') {
        if (runningToolDepth === 0 && !isNestedNamespace(event)) {
          // Arg streams are keyed by chunk index within one model turn. Some
          // OpenAI-compatible providers omit the tool-call id on a turn's
          // first chunk, so without a reset a NEW turn's chunks at index 0
          // would append onto the PREVIOUS turn's call — reopening a card the
          // client already completed and spawning a duplicate for the real
          // execution. A new turn always starts from a clean slate.
          toolArgStreams.clear();
          for (const [id, sc] of streamedToolCalls) {
            // Bound entries stay: a still-running task card's id must remain
            // resolvable for its late TOOL_CALL_RESULT.
            if (!sc.bound) streamedToolCalls.delete(id);
          }
        }
      }

      // ── Tool call start ──────────────────────────────────────────────────────
      else if (event.event === 'on_tool_start') {
        if (liveToolRuns.has(event.run_id)) {
          logger?.debug('[AG-UI] skipping duplicate on_tool_start delivery', {
            name: event.name,
          });
          continue;
        }
        liveToolRuns.add(event.run_id);
        runningToolDepth += 1;

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

        const toolName = event.name;
        const toolInput = event.data?.input;
        const argsStr = typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput ?? {});

        // A subagent's internal tool call must not surface as a main-agent tool
        // card — scope it to the owning task card as a timeline entry instead.
        // Run ancestry is the authoritative signal; nested checkpoint namespace
        // and (when namespace metadata is absent) a running task are fallbacks.
        const ancestryHost = findTaskAncestor(event.run_id);
        const isNestedTool =
          Boolean(ancestryHost) ||
          isNestedNamespace(event) ||
          (taskToolStack.length > 0 && !event.metadata?.langgraph_checkpoint_ns);
        if (isNestedTool) {
          const hostTask = ancestryHost || taskToolStack[taskToolStack.length - 1];
          if (hostTask) {
            nestedToolRuns.set(event.run_id, { name: toolName, toolCallId: hostTask.toolCallId });
            logger?.debug('[AG-UI] subagent tool call', {
              name: toolName,
              hostToolCallId: hostTask.toolCallId,
            });
            yield {
              type: EventType.CUSTOM,
              name: 'subagent_activity',
              value: {
                toolCallId: hostTask.toolCallId,
                kind: 'tool_start',
                toolName,
                args: argsStr,
              },
            };
          } else {
            logger?.debug('[AG-UI] dropping nested tool with no host task', { name: toolName });
          }
          continue;
        }

        // A tool call ends the current text grouping.
        textMsgId = null;
        stats.toolCalls += 1;

        // If this call's args were already streamed from tool_call_chunks, bind
        // execution to that toolCallId instead of re-emitting the args. Only
        // top-level tools can match — a subagent's internal tool must never
        // steal a streamed main-model call of the same name. Prefer an exact
        // args match, fall back to FIFO by name.
        let streamedId = null;
        if (!isNestedNamespace(event)) {
          for (const [id, sc] of streamedToolCalls) {
            if (sc.bound || sc.name !== toolName) continue;
            if (sc.args === argsStr) {
              streamedId = id;
              break;
            }
            if (!streamedId) streamedId = id;
          }
        }

        if (toolName === 'task') {
          taskToolStack.push({ runId: event.run_id, toolCallId: streamedId || event.run_id });
          taskRuns.set(event.run_id, streamedId || event.run_id);
        }

        if (streamedId) {
          streamedToolCalls.get(streamedId).bound = true;
          pendingToolCalls.set(event.run_id, { name: toolName, toolCallId: streamedId });
          logger?.debug('[AG-UI] tool call (args pre-streamed)', {
            name: toolName,
            toolCallId: streamedId,
          });
        } else {
          pendingToolCalls.set(event.run_id, { name: toolName, toolCallId: event.run_id });
          logger?.debug('[AG-UI] tool call', {
            name: toolName,
            toolCallId: event.run_id,
            argsLength: argsStr.length,
          });
          // TOOL_CALL_CHUNK carries id + name + args and needs no parentMessageId.
          yield {
            type: EventType.TOOL_CALL_CHUNK,
            toolCallId: event.run_id,
            toolCallName: toolName,
            delta: argsStr,
          };
        }

        // This tool's MCP server declared a `_meta.ui.resourceUri` widget for it
        // (see tools/mcp.tools.js) - tell the client which MCP App to render
        // alongside this tool call's card.
        const mcpApp = mcpAppMap[toolName];
        if (mcpApp) {
          yield {
            type: EventType.CUSTOM,
            name: 'mcp_app',
            value: {
              toolCallId: streamedId || event.run_id,
              resourceUri: mcpApp.resourceUri,
              mcpId: mcpApp.mcpId,
            },
          };
        }
      }

      // ── Tool call result ─────────────────────────────────────────────────────
      else if (event.event === 'on_tool_end' || event.event === 'on_tool_error') {
        // An end whose start was never processed is either a duplicate
        // delivery or an orphan — both must be ignored (and must not
        // corrupt runningToolDepth).
        if (!liveToolRuns.has(event.run_id)) {
          logger?.debug('[AG-UI] skipping unmatched tool end delivery', { name: event.name });
          continue;
        }
        liveToolRuns.delete(event.run_id);
        runningToolDepth = Math.max(0, runningToolDepth - 1);

        const taskIndex = taskToolStack.findIndex((t) => t.runId === event.run_id);
        if (taskIndex !== -1) taskToolStack.splice(taskIndex, 1);
        taskRuns.delete(event.run_id);

        const nestedRun = nestedToolRuns.get(event.run_id);
        if (nestedRun) {
          nestedToolRuns.delete(event.run_id);
          if (event.event === 'on_tool_end') {
            // Results feed the card's timeline only — cap them so a verbose
            // nested tool can't bloat the SSE stream.
            const nestedResult = extractToolOutputContent(event.data?.output).slice(0, 4000);
            yield {
              type: EventType.CUSTOM,
              name: 'subagent_activity',
              value: {
                toolCallId: nestedRun.toolCallId,
                kind: 'tool_result',
                toolName: nestedRun.name,
                result: nestedResult,
              },
            };
          } else {
            // A failed nested tool must still close out its timeline entry —
            // otherwise it's stranded "running" forever inside the task card,
            // even though the subagent itself recovers and keeps going.
            logger?.debug('[AG-UI] nested tool error', {
              name: nestedRun.name,
              hostToolCallId: nestedRun.toolCallId,
              error: extractToolErrorMessage(event.data?.error),
            });
            yield {
              type: EventType.CUSTOM,
              name: 'subagent_activity',
              value: {
                toolCallId: nestedRun.toolCallId,
                kind: 'tool_result',
                toolName: nestedRun.name,
                result: buildToolErrorContent(event.data?.error),
              },
            };
          }
          continue;
        }

        if (event.name === 'ask_clarification') {
          logger?.debug('[AG-UI] hiding clarification tool result');
          continue;
        }

        const tc = pendingToolCalls.get(event.run_id);
        if (tc) {
          pendingToolCalls.delete(event.run_id);
          const isError = event.event === 'on_tool_error';
          const resultContent = isError
            ? buildToolErrorContent(event.data?.error)
            : extractToolOutputContent(event.data?.output);
          const structuredContent = isError ? undefined : extractStructuredContent(event.data?.output);
          stats.toolResults += 1;
          textSinceLastToolResult = false;
          lastToolResult = { name: tc.name, content: resultContent };
          if (isError) {
            logger?.debug('[AG-UI] tool error', {
              name: tc.name,
              toolCallId: tc.toolCallId,
              error: extractToolErrorMessage(event.data?.error),
            });
          } else {
            logger?.debug('[AG-UI] tool result', {
              name: tc.name,
              toolCallId: tc.toolCallId,
              resultLength: resultContent.length,
            });
          }
          yield {
            type: EventType.TOOL_CALL_RESULT,
            messageId: randomUUID(),
            toolCallId: tc.toolCallId,
            content: resultContent,
            role: 'tool',
            // Forwarded so MCP App widgets (which read result.structuredContent,
            // not the flattened text) get the data their ontoolresult expects.
            ...(structuredContent !== undefined ? { structuredContent } : {}),
          };
        }
      }
    }

    // Close a reasoning message left open by a turn that ended mid-thought.
    if (reasoningMsgId) {
      reasoningMsgId = null;
      yield { type: EventType.REASONING_END };
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
    if (reasoningMsgId) {
      reasoningMsgId = null;
      yield { type: EventType.REASONING_END };
    }
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
    else if (err?.name === 'AbortError') {
      logger?.info('[AG-UI] stream aborted by client');
      return;
    }
  }
}
