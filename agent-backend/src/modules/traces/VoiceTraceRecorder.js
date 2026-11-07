import { serializeForTrace } from './traceSerializer.js';
import { SPAN_KIND } from './traceSpan.model.js';
import { TraceRecorder } from './TraceRecorder.js';
import { VoiceUsageMeter, toTraceUsage } from './VoiceUsageMeter.js';

/**
 * In-memory step tree for one Gemini Live voice call (one trace per call).
 *
 * Text traces come from TraceRecorder (LangChain callbacks); a voice call
 * has no LangGraph run, so VoiceSession reports its own events here instead:
 *
 *   Turn N            chain   (RUN_STARTED → RUN_FINISHED)
 *   ├─ User           human   (final transcript / typed text / image)
 *   ├─ <tool>         tool    (server, browser or synthetic end_call)
 *   │   └─ …          nested LLM / retriever steps (TraceRecorder callbacks)
 *   ├─ User interrupted  interrupt (barge-in)
 *   └─ Agent          llm     (transcript, time to first audio, usage)
 *
 * Every method is synchronous in-memory bookkeeping. Spans are handed out
 * once, when closed (`drainClosed`), for the periodic flush.
 */

const TEXT_CHARS = 16000;
const TOOL_IO_CHARS = 16000;
// A closed turn / agent step is held back this long before it is flushed,
// so a usage message that arrives just after turnComplete still lands on it.
const CLOSE_GRACE_MS = 2000;

function emptyUsage() {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function addFlat(target, counted) {
  for (const [k, v] of Object.entries(counted)) target[k] = (target[k] || 0) + v;
}

export class VoiceTraceRecorder {
  /**
   * @param {object} [opts]
   * @param {string} [opts.model]
   * @param {string} [opts.provider]
   * @param {string} [opts.usageMode] see VoiceUsageMeter
   * @param {() => number} [opts.timelineMs] ms since the call (and recording) started
   */
  constructor({
    model = null,
    provider = null,
    usageMode = 'auto',
    maxSpans = 1500,
    now = () => Date.now(),
    timelineMs = null,
  } = {}) {
    this.model = model;
    this.provider = provider;
    this.maxSpans = maxSpans;
    this.now = now;
    this.timelineMs = timelineMs;
    this.meter = new VoiceUsageMeter({ mode: usageMode, now });
    this.spans = new Map(); // spanId -> span
    this.emitted = new Set();
    this.seq = 0;
    this.truncated = false;

    this.turn = null; // open turn span
    this.turnCount = 0;
    this.agent = null; // open agent span
    this.agentFlat = new Map(); // agent spanId -> flat usage counts
    this.tools = new Map(); // toolCallId -> { span, recorder }
    this.speechStartedAt = null;
    this.speechEndedAt = null;
    this.interruptFlag = false;

    this.firstInput = null;
    this.lastOutput = null;
    this.interruptions = 0;
    this.reconnects = 0;
    this.imagesSent = 0;
    this.firstAudioLatencies = [];
    this.nested = { llmCalls: 0, usage: emptyUsage() };
  }

  // ── bookkeeping ────────────────────────────────────────────────────────

  _id(prefix) {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  _tl() {
    try {
      return this.timelineMs ? Math.round(this.timelineMs()) : null;
    } catch {
      return null;
    }
  }

  _open(fields, { at } = {}) {
    if (this.spans.size >= this.maxSpans) {
      this.truncated = true;
      return null;
    }
    const span = {
      spanId: this._id(fields.kind),
      parentSpanId: null,
      status: 'running',
      startedAt: at ?? this.now(),
      endedAt: null,
      durationMs: null,
      timeToFirstTokenMs: null,
      model: null,
      provider: null,
      usage: emptyUsage(),
      input: null,
      output: null,
      error: null,
      metadata: { voice: true },
      ...fields,
    };
    this.spans.set(span.spanId, span);
    return span;
  }

  _close(span, fields = {}) {
    if (!span || span.endedAt) return span;
    span.endedAt = this.now();
    span.durationMs = span.endedAt - span.startedAt;
    if (span.status === 'running') span.status = 'success';
    Object.assign(span, fields);
    return span;
  }

  _event(fields) {
    const span = this._open({ parentSpanId: this.turn?.spanId ?? null, ...fields });
    if (span) this._close(span);
    return span;
  }

  _ensureTurn() {
    if (!this.turn) this.turnStart(null);
    return this.turn;
  }

  // ── turns ──────────────────────────────────────────────────────────────

  turnStart(runId) {
    if (this.turn) this.turnEnd();
    this.turnCount += 1;
    this.turn = this._open({
      kind: SPAN_KIND.CHAIN,
      name: `Turn ${this.turnCount}`,
      input: null,
      output: null,
      metadata: {
        voice: true,
        turn: this.turnCount,
        runId: runId || null,
        audio: { startMs: this._tl() },
      },
    });
    if (!this.turn) this.turn = { spanId: null, metadata: {}, _dummy: true };
  }

  turnEnd() {
    const turn = this.turn;
    if (!turn) return;
    this._closeAgent();
    this.turn = null;
    if (turn._dummy) return;
    this._lastTurnId = turn.spanId; // late usage still lands on this turn
    turn.metadata.audio = { ...turn.metadata.audio, endMs: this._tl() };
    this._close(turn);
  }

  // ── user ───────────────────────────────────────────────────────────────

  userSpeechStart() {
    this._ensureTurn();
    this.speechStartedAt = this.now();
    this.speechStartTl = this._tl();
    this.speechEndedAt = null;
  }

  userSpeechEnd() {
    this.speechEndedAt = this.now();
    this.speechEndTl = this._tl();
  }

  /**
   * @param {string} text
   * @param {{via?: 'speech'|'text'|'image', attachments?: object[]}} [opts]
   */
  userSaid(text, { via = 'speech', attachments } = {}) {
    if (this.agent && this.interruptFlag) this._closeAgent();
    const turn = this._ensureTurn();
    const content = typeof text === 'string' ? text.slice(0, TEXT_CHARS) : '';
    if (!content && !attachments?.length) return;
    if (via === 'image') this.imagesSent += 1;
    const at = via === 'speech' && this.speechStartedAt ? this.speechStartedAt : this.now();
    const span = this._open(
      {
        parentSpanId: turn.spanId,
        kind: SPAN_KIND.HUMAN,
        name: via === 'image' ? 'User (image)' : via === 'text' ? 'User (typed)' : 'User',
        output: { role: 'user', content },
        metadata: {
          voice: true,
          via,
          ...(attachments?.length ? { attachments: serializeForTrace(attachments, 4000) } : {}),
          ...(via === 'speech'
            ? {
                audio: {
                  startMs: this.speechStartTl ?? this._tl(),
                  endMs: this.speechEndTl ?? this._tl(),
                },
              }
            : {}),
        },
      },
      { at }
    );
    this._close(span);
    if (via === 'speech' && !this.speechEndedAt) this.userSpeechEnd();
    if (!turn._dummy) {
      turn.input = turn.input ? `${turn.input}\n${content}` : content;
    }
    if (this.firstInput == null && content) this.firstInput = content;
  }

  // ── agent ──────────────────────────────────────────────────────────────

  _openAgent({ firstAudio = false, audioAt = null } = {}) {
    if (this.agent) return this.agent;
    const turn = this._ensureTurn();
    const start =
      this.speechEndedAt && this.speechEndedAt <= this.now() ? this.speechEndedAt : this.now();
    this.agent = this._open(
      {
        parentSpanId: turn.spanId,
        kind: SPAN_KIND.LLM,
        name: 'Agent',
        model: this.model,
        provider: this.provider,
        input: turn.input ? [{ role: 'user', content: turn.input }] : null,
        metadata: { voice: true, audio: audioAt ? { startMs: audioAt.startMs } : {} },
      },
      { at: start }
    );
    if (this.agent && firstAudio) {
      const latency = this.now() - start;
      this.agent.timeToFirstTokenMs = latency;
      this.agent.metadata.firstAudioMs = latency;
      if (this.speechEndedAt) this.firstAudioLatencies.push(latency);
    }
    if (this.agent) this.agentFlat.set(this.agent.spanId, {});
    return this.agent;
  }

  /** First and later agent audio chunks; `placed` is where the chunk plays. */
  agentAudio(placed) {
    // A step cut off by a barge-in (with no words flushed) ends here.
    if (this.agent && this.interruptFlag) this._closeAgent();
    if (!this.agent) this._openAgent({ firstAudio: true, audioAt: placed });
    if (this.agent && placed) {
      const a = this.agent.metadata.audio || (this.agent.metadata.audio = {});
      if (a.startMs == null) a.startMs = placed.startMs;
      a.endMs = placed.endMs;
    }
  }

  agentSaid(text, { partial } = {}) {
    const content = typeof text === 'string' ? text.slice(0, TEXT_CHARS) : '';
    if (!content) return;
    const span = this._openAgent();
    if (span) {
      span.output = { role: 'assistant', content };
      if (partial) span.metadata.partial = true;
    }
    if (this.turn && !this.turn._dummy) {
      this.turn.output = this.turn.output ? `${this.turn.output}\n${content}` : content;
    }
    this.lastOutput = content;
    this._closeAgent();
  }

  _closeAgent() {
    const span = this.agent;
    if (!span) return;
    if (this.interruptFlag) span.metadata.partial = true;
    this.agent = null;
    this._lastAgent = span; // late usage still lands on this step
    this.interruptFlag = false;
    this.speechStartedAt = null;
    this.speechEndedAt = null;
    this.speechStartTl = null;
    this.speechEndTl = null;
    this._close(span);
  }

  interrupted({ droppedAgentMs } = {}) {
    this.interruptions += 1;
    // VoiceSession reports the barge-in just before flushing the agent's
    // words, so the flushed line (or the open step, if no words came) is
    // marked as cut off.
    this.interruptFlag = Boolean(this.agent);
    this._event({
      kind: SPAN_KIND.INTERRUPT,
      name: 'User interrupted',
      metadata: {
        voice: true,
        bargeIn: true,
        audio: { startMs: this._tl() },
        ...(droppedAgentMs ? { droppedAgentMs } : {}),
      },
    });
    if (this.turn && !this.turn._dummy) this.turn.metadata.interrupted = true;
  }

  reconnected() {
    this.reconnects += 1;
    this._event({
      kind: SPAN_KIND.CHAIN,
      name: 'Reconnected to Gemini',
      metadata: { voice: true, reconnect: true },
    });
  }

  // ── tools ──────────────────────────────────────────────────────────────

  /**
   * @param {{id: string, name: string, args?: object}} fc
   * @param {{frontend?: boolean, synthetic?: boolean}} [kind]
   */
  toolStart(fc, { frontend = false, synthetic = false } = {}) {
    const turn = this._ensureTurn();
    const span = this._open({
      parentSpanId: turn.spanId,
      kind: SPAN_KIND.TOOL,
      name: String(fc?.name || 'tool'),
      input: serializeForTrace(fc?.args ?? {}, TOOL_IO_CHARS),
      metadata: {
        voice: true,
        toolCallId: fc?.id || null,
        ...(frontend ? { frontend: true } : {}),
        ...(synthetic ? { synthetic: true } : {}),
      },
    });
    if (span && fc?.id) this.tools.set(fc.id, { span, recorder: null });
    return span;
  }

  /** LangChain callbacks for a server tool, so its own LLM/retriever steps nest under it. */
  toolCallbacks(toolCallId) {
    const entry = this.tools.get(toolCallId);
    if (!entry) return [];
    entry.recorder = new TraceRecorder({ maxSpans: 200, now: this.now });
    return [entry.recorder];
  }

  toolEnd(toolCallId, { output, error, cancelled = false } = {}) {
    const entry = this.tools.get(toolCallId);
    if (!entry) return;
    this.tools.delete(toolCallId);
    const { span, recorder } = entry;
    if (cancelled) {
      span.metadata.cancelled = true;
      this._close(span, { status: 'error', error: error || 'Cancelled by the model' });
    } else if (error) {
      this._close(span, { status: 'error', error: String(error).slice(0, 4000) });
    } else {
      this._close(span, { output: serializeForTrace(output, TOOL_IO_CHARS) });
    }
    if (recorder) this._adoptNested(recorder, span);
  }

  _adoptNested(recorder, toolSpan) {
    let result;
    try {
      result = recorder.finalize({});
    } catch {
      return;
    }
    // The tool's own LangChain run is a top-level span there — drop it and
    // hang its children under our tool span.
    const tops = new Set(result.spans.filter((s) => !s.parentSpanId).map((s) => s.spanId));
    for (const s of result.spans) {
      if (tops.has(s.spanId)) continue;
      if (this.spans.size >= this.maxSpans) {
        this.truncated = true;
        break;
      }
      const copy = {
        ...s,
        spanId: `${toolSpan.spanId}:${s.spanId}`,
        parentSpanId:
          !s.parentSpanId || tops.has(s.parentSpanId)
            ? toolSpan.spanId
            : `${toolSpan.spanId}:${s.parentSpanId}`,
      };
      this.spans.set(copy.spanId, copy);
    }
    this.nested.llmCalls += result.llmCalls;
    this.nested.usage.inputTokens += result.usage.inputTokens;
    this.nested.usage.outputTokens += result.usage.outputTokens;
    this.nested.usage.totalTokens += result.usage.totalTokens;
  }

  // ── tokens ─────────────────────────────────────────────────────────────

  usage(usageMetadata) {
    const turnId = this.turn?.spanId ?? this._lastTurnId ?? null;
    const counted = this.meter.record(usageMetadata, { turnId });
    const target = this.agent || this._lastAgent;
    if (target && this.agentFlat.has(target.spanId))
      addFlat(this.agentFlat.get(target.spanId), counted);
    return counted;
  }

  // ── output ─────────────────────────────────────────────────────────────

  _applyUsage(span) {
    if (span.kind === SPAN_KIND.CHAIN && span.metadata?.turn) {
      span.usage = this.meter.turnUsage(span.spanId);
    } else if (span.kind === SPAN_KIND.LLM && this.agentFlat.has(span.spanId)) {
      const flat = this.agentFlat.get(span.spanId);
      span.usage = toTraceUsage({
        prompt: 0,
        response: 0,
        toolUse: 0,
        thoughts: 0,
        cached: 0,
        total: 0,
        inAudio: 0,
        inText: 0,
        inImage: 0,
        inVideo: 0,
        outAudio: 0,
        outText: 0,
        ...flat,
      });
    }
  }

  /**
   * Closed spans not handed out yet. A just-closed turn or agent step is
   * held for CLOSE_GRACE_MS (late usage messages); `final` hands out
   * everything, closing what is still open.
   */
  drainClosed({ final = false } = {}) {
    if (final) {
      this.turnEnd();
      for (const { span } of this.tools.values()) {
        span.metadata.cancelled = true;
        this._close(span, { status: 'error', error: 'Call ended before this tool finished' });
      }
      this.tools.clear();
      for (const span of this.spans.values()) if (!span.endedAt) this._close(span);
    }
    const now = this.now();
    const out = [];
    for (const span of this.spans.values()) {
      if (this.emitted.has(span.spanId) || !span.endedAt) continue;
      const graced = span.kind === SPAN_KIND.CHAIN || span.kind === SPAN_KIND.LLM;
      if (!final && graced && now - span.endedAt < CLOSE_GRACE_MS) continue;
      this._applyUsage(span);
      this.emitted.add(span.spanId);
      out.push(span);
    }
    return out.sort((a, b) => a.startedAt - b.startedAt);
  }

  totals() {
    let llmCalls = this.nested.llmCalls;
    let toolCalls = 0;
    let toolErrors = 0;
    for (const s of this.spans.values()) {
      if (s.kind === SPAN_KIND.LLM && s.metadata?.voice) llmCalls += 1;
      if (s.kind === SPAN_KIND.TOOL) {
        toolCalls += 1;
        if (s.status === 'error') toolErrors += 1;
      }
    }
    const gemini = this.meter.totals();
    const usage = {
      inputTokens: gemini.inputTokens + this.nested.usage.inputTokens,
      outputTokens: gemini.outputTokens + this.nested.usage.outputTokens,
      totalTokens: gemini.totalTokens + this.nested.usage.totalTokens,
      details: gemini.details,
    };
    return {
      usage,
      llmCalls,
      toolCalls,
      toolErrors,
      spanCount: this.spans.size,
      truncated: this.truncated,
      input: this.firstInput,
      output: this.lastOutput,
      voice: {
        turns: this.turnCount,
        interruptions: this.interruptions,
        reconnects: this.reconnects,
        imagesSent: this.imagesSent,
        latency: {
          firstAudioP50Ms: percentile(this.firstAudioLatencies, 50),
          firstAudioP95Ms: percentile(this.firstAudioLatencies, 95),
        },
      },
    };
  }
}

export default VoiceTraceRecorder;
