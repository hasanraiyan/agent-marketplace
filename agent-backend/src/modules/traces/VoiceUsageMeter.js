/**
 * Token accounting for one Gemini Live voice call.
 *
 * Gemini Live sends `usageMetadata` (`@google/genai` UsageMetadata) on many
 * server messages. Each message is documented as "usage metadata about model
 * response(s)" — and Live re-processes the whole conversation context on
 * every response, so a call's real usage is the SUM over responses, not the
 * last message (which is all VoiceSession used to keep).
 *
 * Because the exact semantics are not guaranteed, the meter supports three
 * modes (config.traces.voiceUsageMode):
 *  - 'per_response': every message is one response's usage → add it.
 *  - 'cumulative':   every message is a session-wide running total → add the
 *                    difference from the previous message.
 *  - 'auto' (default): per response, except that a message which restates
 *                    the previous one of the SAME turn (same prompt count,
 *                    nothing smaller) is treated as a running update of that
 *                    response, so only the difference is added.
 */

const MODALITY = {
  AUDIO: 'audio',
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
};

const FIELDS = [
  'prompt',
  'response',
  'toolUse',
  'thoughts',
  'cached',
  'total',
  'inAudio',
  'inText',
  'inImage',
  'inVideo',
  'outAudio',
  'outText',
];

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

function byModality(details, prefix, out) {
  if (!Array.isArray(details)) return;
  for (const d of details) {
    const key = MODALITY[String(d?.modality || '').toUpperCase()];
    if (!key) continue;
    const field = `${prefix}${key[0].toUpperCase()}${key.slice(1)}`;
    if (field in out) out[field] += num(d.tokenCount);
  }
}

/** UsageMetadata → flat counts. */
export function normalizeUsage(u) {
  const out = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  if (!u || typeof u !== 'object') return out;
  out.prompt = num(u.promptTokenCount);
  out.response = num(u.responseTokenCount ?? u.candidatesTokenCount);
  out.toolUse = num(u.toolUsePromptTokenCount);
  out.thoughts = num(u.thoughtsTokenCount);
  out.cached = num(u.cachedContentTokenCount);
  out.total = num(u.totalTokenCount) || out.prompt + out.response + out.toolUse + out.thoughts;
  byModality(u.promptTokensDetails, 'in', out);
  byModality(u.toolUsePromptTokensDetails, 'in', out);
  byModality(u.responseTokensDetails ?? u.candidatesTokensDetails, 'out', out);
  return out;
}

function zero() {
  return Object.fromEntries(FIELDS.map((f) => [f, 0]));
}

function add(a, b) {
  for (const f of FIELDS) a[f] += b[f];
  return a;
}

function diff(next, prev) {
  const d = zero();
  for (const f of FIELDS) d[f] = Math.max(0, next[f] - prev[f]);
  return d;
}

function restates(next, prev) {
  if (!prev) return false;
  if (next.prompt !== prev.prompt) return false;
  return FIELDS.every((f) => next[f] >= prev[f]);
}

/** Flat counts → the trace `usage` shape (+ details). */
export function toTraceUsage(c) {
  return {
    inputTokens: c.prompt + c.toolUse,
    outputTokens: c.response + c.thoughts,
    totalTokens: c.total,
    details: {
      input: { audio: c.inAudio, text: c.inText, image: c.inImage, video: c.inVideo },
      output: { audio: c.outAudio, text: c.outText },
      toolUse: c.toolUse,
      thoughts: c.thoughts,
      cached: c.cached,
      responses: c.responses || 0,
    },
  };
}

export class VoiceUsageMeter {
  constructor({ mode = 'auto', maxResponses = 500, now = () => Date.now() } = {}) {
    this.mode = ['auto', 'per_response', 'cumulative'].includes(mode) ? mode : 'auto';
    this.maxResponses = maxResponses;
    this.now = now;
    this.total = { ...zero(), responses: 0 };
    this.byTurn = new Map(); // turnId -> counts
    this.responses = []; // [{ at, turnId, counted, raw }] (capped)
    this.last = null; // last normalized message (any turn)
    this.lastTurnId = null;
  }

  /**
   * Counts one usageMetadata message.
   * @returns {object} the counts actually added (flat)
   */
  record(usageMetadata, { turnId = null } = {}) {
    const next = normalizeUsage(usageMetadata);
    let counted;
    let restatement = false;
    if (this.mode === 'cumulative') {
      counted = this.last ? diff(next, this.last) : next;
    } else if (this.mode === 'auto' && this.lastTurnId === turnId && restates(next, this.last)) {
      counted = diff(next, this.last);
      restatement = true;
    } else {
      counted = next;
    }
    this.last = next;
    this.lastTurnId = turnId;

    add(this.total, counted);
    if (!restatement) this.total.responses += 1;
    if (turnId) {
      const t = this.byTurn.get(turnId) || { ...zero(), responses: 0 };
      add(t, counted);
      if (!restatement) t.responses += 1;
      this.byTurn.set(turnId, t);
    }
    if (this.responses.length < this.maxResponses) {
      this.responses.push({ at: this.now(), turnId, counted, restatement });
    }
    return counted;
  }

  totals() {
    return toTraceUsage(this.total);
  }

  turnUsage(turnId) {
    const t = this.byTurn.get(turnId);
    return t ? toTraceUsage(t) : toTraceUsage({ ...zero(), responses: 0 });
  }

  /** Legacy `voice_session_ended.usage` numbers, now summed for the call. */
  sessionEndedUsage() {
    const u = this.totals();
    return {
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      totalTokens: u.totalTokens,
    };
  }
}

export default VoiceUsageMeter;
