import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { SPAN_KIND } from './traceSpan.model.js';
import { serializeForTrace, contentToText } from './traceSerializer.js';

/**
 * Records every LLM / tool / subagent / retriever / graph-node step of one
 * agent run as a span tree, in memory. Rides alongside `RunScopeTracker` on
 * the same `streamEvents` call; `traceService` persists the result when the
 * run ends (nothing touches the DB from inside a callback, so tracing never
 * slows the stream).
 *
 * Noise control (what LangSmith hides too):
 *   - runs tagged `langsmith:hidden` (LangGraph's internal channel writes,
 *     branches, `__start__`) are never stored;
 *   - chains that are not a graph node (RunnableSequence/RunnableLambda
 *     wrappers inside a node) are never stored;
 *   - graph-node spans that ended with no child steps and no error are
 *     dropped at `finalize()` (empty middleware hooks).
 * A skipped run's children are re-parented to its nearest stored ancestor.
 *
 * Callback argument order: LangChain's CallbackManager passes
 * `(…, runId, parentRunId, tags, metadata, …)` to handleChainStart too —
 * its .d.ts says otherwise, see callbacks/manager.js.
 *
 * One instance per run.
 */

const HIDDEN_TAG = 'langsmith:hidden';
const INTERRUPT_ERROR_NAMES = new Set(['GraphInterrupt', 'NodeInterrupt']);
const LLM_IO_CHARS = 24000;
const TOOL_IO_CHARS = 16000;

/**
 * A graph node's input/output → its messages (what LangSmith shows for a
 * node), not the whole state. Node outputs are state updates, Commands, or
 * arrays of either.
 */
function chainPayload(value) {
  if (value === undefined || value === null) return null;
  const collect = (v) => {
    if (!v || typeof v !== 'object') return null;
    if (Array.isArray(v.messages)) return v.messages;
    if (Array.isArray(v.update?.messages)) return v.update.messages;
    return null;
  };
  const direct = collect(value);
  if (direct) return serializeForTrace(direct, LLM_IO_CHARS);
  if (Array.isArray(value)) {
    const msgs = value.flatMap((v) => collect(v) || []);
    if (msgs.length > 0) return serializeForTrace(msgs, LLM_IO_CHARS);
  }
  return serializeForTrace(value, 4000);
}

function serializedName(serialized) {
  if (!serialized) return null;
  if (serialized.name) return serialized.name;
  if (Array.isArray(serialized.id) && serialized.id.length > 0) return serialized.id.at(-1);
  return null;
}

function errorText(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err.slice(0, 4000);
  const name = err.name && err.name !== 'Error' ? `${err.name}: ` : '';
  return `${name}${err.message || String(err)}`.slice(0, 4000);
}

function parseToolInput(input) {
  if (typeof input !== 'string') return input;
  const trimmed = input.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return input;
    }
  }
  return input;
}

/** Normalizes the token usage reported on an LLMResult. */
export function extractUsage(output) {
  const gen = output?.generations?.[0]?.[0];
  const um = gen?.message?.usage_metadata;
  if (um && (um.input_tokens || um.output_tokens || um.total_tokens)) {
    const inputTokens = um.input_tokens || 0;
    const outputTokens = um.output_tokens || 0;
    return {
      inputTokens,
      outputTokens,
      totalTokens: um.total_tokens || inputTokens + outputTokens,
    };
  }
  const tu = output?.llmOutput?.tokenUsage || output?.llmOutput?.estimatedTokenUsage;
  if (tu) {
    const inputTokens = tu.promptTokens || tu.input_tokens || 0;
    const outputTokens = tu.completionTokens || tu.output_tokens || 0;
    return { inputTokens, outputTokens, totalTokens: tu.totalTokens || inputTokens + outputTokens };
  }
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

/** A tool's return value → something readable (ToolMessage / Command / raw). */
function toolOutput(output) {
  if (output && typeof output === 'object') {
    if ('content' in output && ('tool_call_id' in output || 'lc_kwargs' in output)) {
      const text = contentToText(output.content);
      return {
        value: serializeForTrace(text || output.content, TOOL_IO_CHARS),
        isError: output.status === 'error',
      };
    }
    // LangGraph Command({ update: { messages: [ToolMessage] } }) — deepagents tools.
    const msgs = output.update?.messages;
    if (Array.isArray(msgs) && msgs.length > 0) {
      const last = msgs.at(-1);
      const text = contentToText(last?.content);
      return {
        value: serializeForTrace(text || last?.content, TOOL_IO_CHARS),
        isError: last?.status === 'error',
      };
    }
  }
  return { value: serializeForTrace(output, TOOL_IO_CHARS), isError: false };
}

export class TraceRecorder extends BaseCallbackHandler {
  name = 'persona-trace-recorder';
  // LangChain JS runs handlers in a background queue by default, which
  // would stamp start/end times late and could still be draining when the
  // run finishes. Recording is cheap in-memory bookkeeping, so run inline:
  // timestamps are accurate and every span is in place before finalize().
  awaitHandlers = true;

  constructor({ maxSpans = 1500, now = () => Date.now() } = {}) {
    super();
    this.maxSpans = maxSpans;
    this.now = now;
    this.spans = new Map(); // runId -> span
    this.skipped = new Map(); // runId -> nearest stored ancestor runId (or null)
    this.rootRunId = null;
    this.rootInput = null;
    this.rootOutput = null;
    this.truncated = false;
  }

  // ── bookkeeping ────────────────────────────────────────────────────────

  _resolveParent(parentRunId) {
    if (!parentRunId) return null;
    if (this.spans.has(parentRunId)) return parentRunId;
    if (this.skipped.has(parentRunId)) return this.skipped.get(parentRunId);
    return null;
  }

  _seen(runId) {
    return this.spans.has(runId) || this.skipped.has(runId);
  }

  _skip(runId, parentRunId) {
    this.skipped.set(runId, this._resolveParent(parentRunId));
  }

  _open(runId, parentRunId, fields) {
    if (this.spans.size >= this.maxSpans) {
      this.truncated = true;
      this._skip(runId, parentRunId);
      return null;
    }
    const span = {
      spanId: runId,
      parentSpanId: this._resolveParent(parentRunId),
      status: 'running',
      startedAt: this.now(),
      endedAt: null,
      durationMs: null,
      timeToFirstTokenMs: null,
      model: null,
      provider: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      input: null,
      output: null,
      error: null,
      metadata: {},
      ...fields,
    };
    this.spans.set(runId, span);
    return span;
  }

  _close(runId, fields = {}) {
    const span = this.spans.get(runId);
    if (!span || span.endedAt) return null;
    span.endedAt = this.now();
    span.durationMs = span.endedAt - span.startedAt;
    span.status = 'success';
    Object.assign(span, fields);
    return span;
  }

  _fail(runId, err) {
    const span = this.spans.get(runId);
    if (!span) return;
    if (INTERRUPT_ERROR_NAMES.has(err?.name)) {
      this._close(runId);
      span.metadata.interrupted = true;
      return;
    }
    this._close(runId, { status: 'error', error: errorText(err) });
  }

  // ── chains (graph nodes) ───────────────────────────────────────────────

  handleChainStart(chain, inputs, runId, parentRunId, tags, metadata, _runType, runName) {
    if (this._seen(runId)) return;
    const name = runName || serializedName(chain) || 'chain';

    if (!parentRunId && !this.rootRunId) {
      this.rootRunId = runId;
      this.rootInput = inputs;
      this._open(runId, null, {
        kind: SPAN_KIND.CHAIN,
        name,
        input: chainPayload(inputs),
        metadata: { root: true },
      });
      return;
    }

    const hidden = Array.isArray(tags) && tags.includes(HIDDEN_TAG);
    const isGraphNode = metadata?.langgraph_node && metadata.langgraph_node === name;
    if (hidden || name.startsWith('__') || !isGraphNode) {
      this._skip(runId, parentRunId);
      return;
    }
    this._open(runId, parentRunId, {
      kind: SPAN_KIND.CHAIN,
      name,
      input: chainPayload(inputs),
      metadata: metadata?.langgraph_step != null ? { step: metadata.langgraph_step } : {},
    });
  }

  handleChainEnd(outputs, runId) {
    if (runId === this.rootRunId) this.rootOutput = outputs;
    if (this.spans.has(runId)) this._close(runId, { output: chainPayload(outputs) });
  }

  handleChainError(err, runId) {
    this._fail(runId, err);
  }

  // ── models ─────────────────────────────────────────────────────────────

  _startModel(llm, input, runId, parentRunId, extraParams, metadata, runName) {
    if (this._seen(runId)) return;
    const invocation = extraParams?.invocation_params || {};
    const model =
      metadata?.ls_model_name ||
      invocation.model ||
      invocation.model_name ||
      invocation.modelName ||
      llm?.kwargs?.model ||
      llm?.kwargs?.model_name ||
      null;
    const toolNames = Array.isArray(invocation.tools)
      ? invocation.tools
          .map((t) => t?.function?.name || t?.name)
          .filter(Boolean)
          .slice(0, 100)
      : undefined;
    const span = this._open(runId, parentRunId, {
      kind: SPAN_KIND.LLM,
      name: runName || serializedName(llm) || 'llm',
      model: model ? String(model) : null,
      provider: metadata?.ls_provider || null,
      input: serializeForTrace(input, LLM_IO_CHARS),
    });
    if (span) {
      if (toolNames?.length) span.metadata.tools = toolNames;
      if (invocation.temperature != null) span.metadata.temperature = invocation.temperature;
    }
  }

  handleChatModelStart(llm, messages, runId, parentRunId, extraParams, _tags, metadata, runName) {
    this._startModel(
      llm,
      messages?.[0] ?? messages,
      runId,
      parentRunId,
      extraParams,
      metadata,
      runName
    );
  }

  handleLLMStart(llm, prompts, runId, parentRunId, extraParams, _tags, metadata, runName) {
    this._startModel(llm, prompts, runId, parentRunId, extraParams, metadata, runName);
  }

  handleLLMNewToken(_token, _idx, runId) {
    const span = this.spans.get(runId);
    if (span && span.timeToFirstTokenMs == null) {
      span.timeToFirstTokenMs = this.now() - span.startedAt;
    }
  }

  handleLLMEnd(output, runId) {
    const span = this.spans.get(runId);
    if (!span) return;
    const gen = output?.generations?.[0]?.[0];
    const message = gen?.message;
    const finishReason =
      message?.response_metadata?.finish_reason ||
      message?.response_metadata?.stop_reason ||
      gen?.generationInfo?.finish_reason ||
      null;
    if (finishReason) span.metadata.finishReason = finishReason;
    if (!span.model && message?.response_metadata?.model_name) {
      span.model = String(message.response_metadata.model_name);
    }
    this._close(runId, {
      usage: extractUsage(output),
      output: serializeForTrace(message ?? gen?.text ?? null, LLM_IO_CHARS),
    });
  }

  handleLLMError(err, runId) {
    this._fail(runId, err);
  }

  // ── tools / subagents ──────────────────────────────────────────────────

  handleToolStart(tool, input, runId, parentRunId, _tags, _metadata, runName, toolCallId) {
    if (this._seen(runId)) return;
    const name = runName || serializedName(tool) || 'tool';
    const parsed = parseToolInput(input);
    const isSubagent = name === 'task';
    const span = this._open(runId, parentRunId, {
      kind: isSubagent ? SPAN_KIND.SUBAGENT : SPAN_KIND.TOOL,
      name:
        isSubagent && parsed && typeof parsed === 'object' && parsed.subagent_type
          ? `task · ${parsed.subagent_type}`
          : name,
      input: serializeForTrace(parsed, TOOL_IO_CHARS),
    });
    if (span && toolCallId) span.metadata.toolCallId = toolCallId;
  }

  handleToolEnd(output, runId) {
    if (!this.spans.has(runId)) return;
    const { value, isError } = toolOutput(output);
    this._close(
      runId,
      isError
        ? { output: value, status: 'error', error: 'Tool returned an error' }
        : { output: value }
    );
  }

  handleToolError(err, runId) {
    this._fail(runId, err);
  }

  // ── retrievers ─────────────────────────────────────────────────────────

  handleRetrieverStart(retriever, query, runId, parentRunId, _tags, _metadata, name) {
    if (this._seen(runId)) return;
    this._open(runId, parentRunId, {
      kind: SPAN_KIND.RETRIEVER,
      name: name || serializedName(retriever) || 'retriever',
      input: serializeForTrace(query, 4000),
    });
  }

  handleRetrieverEnd(documents, runId) {
    const docs = Array.isArray(documents) ? documents : [];
    this._close(runId, {
      output: serializeForTrace(
        {
          count: docs.length,
          documents: docs.slice(0, 10).map((d) => ({
            content: typeof d?.pageContent === 'string' ? d.pageContent.slice(0, 800) : null,
            metadata: d?.metadata,
          })),
        },
        TOOL_IO_CHARS
      ),
    });
  }

  handleRetrieverError(err, runId) {
    this._fail(runId, err);
  }

  // ── result ─────────────────────────────────────────────────────────────

  /**
   * Closes any span still open (run aborted / interrupted mid-step), drops
   * empty graph-node spans, and computes run totals.
   *
   * @param {{ cancelled?: boolean }} [opts]
   */
  finalize({ cancelled = false } = {}) {
    const endedAt = this.now();
    for (const span of this.spans.values()) {
      if (!span.endedAt) {
        span.endedAt = endedAt;
        span.durationMs = endedAt - span.startedAt;
        span.status = cancelled ? 'error' : 'success';
        if (cancelled) span.error = 'Run ended before this step finished';
      }
    }

    // Drop childless, error-free, non-root chain spans; repeat because
    // dropping one can leave its parent childless.
    let dropped = true;
    while (dropped) {
      dropped = false;
      const hasChild = new Set();
      for (const s of this.spans.values()) if (s.parentSpanId) hasChild.add(s.parentSpanId);
      for (const [id, s] of this.spans) {
        if (
          s.kind === SPAN_KIND.CHAIN &&
          id !== this.rootRunId &&
          s.status !== 'error' &&
          !s.metadata.interrupted &&
          !hasChild.has(id)
        ) {
          this.spans.delete(id);
          dropped = true;
        }
      }
    }

    const spans = [...this.spans.values()].sort((a, b) => a.startedAt - b.startedAt);
    const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let llmCalls = 0;
    let toolCalls = 0;
    let toolErrors = 0;
    let model = null;
    let provider = null;
    for (const s of spans) {
      if (s.kind === SPAN_KIND.LLM) {
        llmCalls += 1;
        usage.inputTokens += s.usage.inputTokens;
        usage.outputTokens += s.usage.outputTokens;
        usage.totalTokens += s.usage.totalTokens;
        if (!model && s.model) model = s.model;
        if (!provider && s.provider) provider = s.provider;
      } else if (s.kind === SPAN_KIND.TOOL || s.kind === SPAN_KIND.SUBAGENT) {
        toolCalls += 1;
        if (s.status === 'error') toolErrors += 1;
      }
    }

    return {
      spans,
      usage,
      llmCalls,
      toolCalls,
      toolErrors,
      model,
      provider,
      truncated: this.truncated,
      output: this.finalOutputText(),
    };
  }

  /** Text of the last assistant message in the root graph's final state. */
  finalOutputText() {
    const msgs = this.rootOutput?.messages;
    if (!Array.isArray(msgs)) return null;
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i];
      let type = null;
      try {
        type = typeof m?.getType === 'function' ? m.getType() : m?._getType?.();
      } catch {
        type = null;
      }
      if (type === 'ai') {
        const text = contentToText(m.content);
        if (text) return text.slice(0, 16000);
      }
      if (type === 'human') break;
    }
    return null;
  }
}

export default TraceRecorder;
