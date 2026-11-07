import mongoose from 'mongoose';
import config from '../../config/index.js';

/**
 * TraceSpan — one step inside a Trace: an LLM call, a tool call, a subagent
 * (`task` tool), a retriever query, or a graph node (chain).
 *
 * `spanId`/`parentSpanId` are LangChain run ids. Internal plumbing runs
 * (tagged `langsmith:hidden`) are never stored; their children are
 * re-parented to the nearest stored ancestor, so the tree stays connected.
 *
 * `input`/`output` are already serialized, size-capped, secret-masked
 * values (see traceSerializer.js) — never raw objects.
 */
export const SPAN_KIND = Object.freeze({
  LLM: 'llm',
  TOOL: 'tool',
  SUBAGENT: 'subagent',
  RETRIEVER: 'retriever',
  CHAIN: 'chain',
  // Synthetic human-in-the-loop steps (no LangChain run behind them):
  INTERRUPT: 'interrupt', // the run paused here, waiting on a person / the client
  HUMAN: 'human', // the person's decision that resumed the run
});

const traceSpanSchema = new mongoose.Schema(
  {
    traceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trace', required: true },
    domain: { type: String, required: true },
    spanId: { type: String, required: true },
    parentSpanId: { type: String, default: null },
    kind: { type: String, enum: Object.values(SPAN_KIND), required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['running', 'success', 'error'], default: 'success' },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    // LLM spans only: time from start to the first streamed token.
    timeToFirstTokenMs: { type: Number, default: null },
    model: { type: String, default: null },
    provider: { type: String, default: null },
    usage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    },
    input: { type: mongoose.Schema.Types.Mixed, default: null },
    output: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

traceSpanSchema.index({ traceId: 1, startedAt: 1 });
traceSpanSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: config.traces.retentionDays * 24 * 60 * 60 }
);

const TraceSpan = mongoose.model('TraceSpan', traceSpanSchema);

export default TraceSpan;
