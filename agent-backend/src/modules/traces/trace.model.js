import mongoose from 'mongoose';
import config from '../../config/index.js';

/**
 * Trace — one recorded agent run (one AG-UI turn) for a Developer Platform
 * Project. The step tree lives in the separate `TraceSpan` collection so a
 * list query never loads hundreds of spans.
 *
 * Written by `traceRecorder` (a LangChain callback handler riding next to
 * `RunScopeTracker` on every `streamEvents` call): created as `running` at
 * run start, finalized with totals when the run ends. Expired by a TTL
 * index after `TRACE_RETENTION_DAYS`.
 */
export const TRACE_STATUS = Object.freeze({
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
  INTERRUPTED: 'interrupted', // paused for human-in-the-loop approval
  CANCELLED: 'cancelled', // client disconnected / aborted
});

const usageSchema = new mongoose.Schema(
  {
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  { _id: false }
);

const traceSchema = new mongoose.Schema(
  {
    // The Project's _id (its domain) — every query is scoped by this.
    domain: { type: String, required: true },
    agentId: { type: String, required: true },
    agentName: { type: String, default: null },
    threadId: { type: String, default: null },
    // 'playground' (Project Admin test chat) | 'api' (Project credential) |
    // 'architect' (the Project Architect agent).
    source: { type: String, default: 'api' },
    // Turn channel: 'web' | 'voice' | 'sms' | 'whatsapp' | ...
    channel: { type: String, default: 'web' },
    // The end user the run acted for: an ExternalUser id (API runs) or the
    // Admin's Persona User id (playground runs).
    endUserId: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(TRACE_STATUS),
      default: TRACE_STATUS.RUNNING,
    },
    model: { type: String, default: null },
    provider: { type: String, default: null },
    input: { type: String, default: null },
    output: { type: String, default: null },
    error: { type: String, default: null },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    usage: { type: usageSchema, default: () => ({}) },
    llmCalls: { type: Number, default: 0 },
    toolCalls: { type: Number, default: 0 },
    toolErrors: { type: Number, default: 0 },
    spanCount: { type: Number, default: 0 },
    // True when the run produced more spans than the per-trace cap.
    truncated: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

traceSchema.index({ domain: 1, startedAt: -1 });
traceSchema.index({ domain: 1, agentId: 1, startedAt: -1 });
traceSchema.index({ domain: 1, threadId: 1, startedAt: -1 });
traceSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: config.traces.retentionDays * 24 * 60 * 60 }
);

const Trace = mongoose.model('Trace', traceSchema);

export default Trace;
