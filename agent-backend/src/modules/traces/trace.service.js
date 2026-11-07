import config from '../../config/index.js';
import { loggerService } from '../../utils/index.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import BaseError from '../../utils/errors/BaseError.js';
import { PERSONA_DOMAIN } from '../auth/personaPrincipalContext.js';
import { PROJECT_ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import traceRepository from './trace.repository.js';
import { TRACE_STATUS } from './trace.model.js';
import { TraceRecorder } from './TraceRecorder.js';
import { SPAN_KIND } from './traceSpan.model.js';
import { summarizeInterrupt, summarizeResume } from './traceInterrupts.js';
import { VoiceCallTracer } from './VoiceCallTracer.js';
import traceAudioStore from './traceAudioStore.js';

const logger = loggerService.getLogger();

const MAX_STATS_DAYS = 90;

const HUMAN_STEP_NAME = {
  hitl: 'Human decision',
  clarification: 'User answered',
  frontend_tool: 'Client tool results',
};

function sourceFor(agentId, executionContext) {
  if (String(agentId) === PROJECT_ARCHITECT_AGENT_ID) return 'architect';
  if (executionContext?.principalType === 'ProjectAdmin') return 'playground';
  return 'api';
}

function endUserFor(executionContext) {
  if (!executionContext) return null;
  if (executionContext.externalUserId) return String(executionContext.externalUserId);
  if (executionContext.personaUserId) return String(executionContext.personaUserId);
  return null;
}

/** '+919876544321' → '+91•••••4321'. The full number is never stored. */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length <= 4) return '••••';
  const plus = phone.trim().startsWith('+') ? '+' : '';
  const cc = plus && digits.length > 10 ? digits.slice(0, digits.length - 10) : '';
  return `${plus}${cc}•••••${digits.slice(-4)}`;
}

// A voice call lasts at most 15 min; anything still running well past that
// was cut off by a crash / restart.
const STALE_VOICE_TRACE_MS = 20 * 60 * 1000;

function voiceStats(v) {
  const tokensByType = {
    inAudio: v?.inAudio || 0,
    inText: v?.inText || 0,
    inImage: v?.inImage || 0,
    outAudio: v?.outAudio || 0,
    outText: v?.outText || 0,
  };
  return {
    calls: v?.calls || 0,
    callMinutes: Math.round(((v?.callMs || 0) / 60000) * 10) / 10,
    recordedMinutes: Math.round(((v?.recordedMs || 0) / 60000) * 10) / 10,
    totalTokens: v?.totalTokens || 0,
    interruptions: v?.interruptions || 0,
    tokensByType,
  };
}

function buildFilter(domain, filters = {}) {
  const filter = { domain: String(domain) };
  if (filters.agentId) filter.agentId = String(filters.agentId);
  if (filters.threadId) filter.threadId = String(filters.threadId);
  if (filters.status && Object.values(TRACE_STATUS).includes(filters.status)) {
    filter.status = filters.status;
  }
  if (filters.source) filter.source = String(filters.source);
  if (filters.channel) filter.channel = String(filters.channel);
  const from = filters.from ? new Date(filters.from) : null;
  const to = filters.to ? new Date(filters.to) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    filter.startedAt = {};
    if (from && !Number.isNaN(from.getTime())) filter.startedAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) filter.startedAt.$lte = to;
  }
  return filter;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/**
 * Built-in run tracing for Developer Platform Project agents.
 *
 * Write path: `begin()` (called by agui.service.js per run) returns a
 * `TraceRecorder` to attach as a LangChain callback plus a `finish()` to
 * call once when the run ends. Every DB write is fail-soft — tracing must
 * never break or delay an agent run.
 *
 * Read path: list / get / stats, scoped to a Project domain, used by the
 * Project Admin routes (project.routes.js → trace.controller.js).
 */
class TraceService {
  /** Persona (consumer/Studio) runs are not traced — Projects only. */
  isEnabledFor(executionContext) {
    return (
      Boolean(config.traces?.enabled) &&
      Boolean(executionContext?.domain) &&
      executionContext.domain !== PERSONA_DOMAIN
    );
  }

  /**
   * @returns {null | { traceId: string, recorder: TraceRecorder, finish: Function }}
   */
  /**
   * @param {object} [params.resume]  `{ pending, value }` when this run resumes a
   *   paused one: `pending` is describeInterrupt() of the pause, `value` the
   *   Command({ resume }) value.
   */
  begin({
    executionContext,
    agentId,
    agentConfig,
    providerConfig,
    threadId,
    channel,
    input,
    resume,
  }) {
    if (!this.isEnabledFor(executionContext)) return null;

    const traceId = traceRepository.newId();
    const recorder = new TraceRecorder();
    const startedAt = new Date();
    const domain = String(executionContext.domain);
    const threadKey = threadId ? String(threadId) : null;

    let resumeSummary = null;
    if (resume?.pending) {
      resumeSummary = summarizeResume(resume.pending, resume.value);
      recorder.addEvent({
        kind: SPAN_KIND.HUMAN,
        name: HUMAN_STEP_NAME[resumeSummary.kind] || 'Human input',
        input: summarizeInterrupt(resume.pending),
        output: resumeSummary,
        metadata: { interruptKind: resumeSummary.kind },
        position: 'start',
      });
    }

    // A resumed run links back to the paused trace on the same thread.
    const previous =
      resumeSummary && threadKey
        ? traceRepository
            .findLatest({ domain, threadId: threadKey, status: TRACE_STATUS.INTERRUPTED })
            .catch(() => null)
        : Promise.resolve(null);

    const created = previous
      .then((prev) =>
        traceRepository
          .create({
            _id: traceId,
            domain,
            agentId: String(agentId),
            agentName:
              agentConfig?.name ||
              (String(agentId) === PROJECT_ARCHITECT_AGENT_ID ? 'Architect' : null),
            threadId: threadKey,
            source: sourceFor(agentId, executionContext),
            channel: channel || 'web',
            endUserId: endUserFor(executionContext),
            status: TRACE_STATUS.RUNNING,
            model: providerConfig?.modelName || agentConfig?.modelName || null,
            provider: providerConfig?.label || null,
            input: resumeSummary
              ? resumeSummary.summary
              : typeof input === 'string'
                ? input.slice(0, 16000)
                : null,
            resume: resumeSummary,
            resumedFromTraceId: prev?._id ? String(prev._id) : null,
            startedAt,
          })
          .then(() => prev)
      )
      .then(async (prev) => {
        if (prev?._id) {
          await traceRepository
            .update(prev._id, { resumedByTraceId: String(traceId) })
            .catch(() => {});
        }
        return true;
      })
      .catch((err) => {
        logger.warn('[Traces] failed to create trace', { domain, agentId, err: err.message });
        return false;
      });

    let finished = false;
    const finish = async ({ status, error, interrupt } = {}) => {
      if (finished) return;
      finished = true;
      try {
        if (!(await created)) return;
        const interruptSummary = interrupt ? summarizeInterrupt(interrupt) : null;
        if (interruptSummary) {
          recorder.addEvent({
            kind: SPAN_KIND.INTERRUPT,
            name: interruptSummary.title,
            input: interruptSummary.actions || interruptSummary.questions || null,
            metadata: { interruptKind: interruptSummary.kind, summary: interruptSummary.summary },
          });
        }
        const result = recorder.finalize({ cancelled: status === TRACE_STATUS.CANCELLED });
        const endedAt = new Date();
        await traceRepository.insertSpans(
          result.spans.map((s) => ({
            ...s,
            traceId,
            domain,
            agentId: String(agentId),
            startedAt: new Date(s.startedAt),
            endedAt: s.endedAt ? new Date(s.endedAt) : null,
          }))
        );
        await traceRepository.update(traceId, {
          status: status || TRACE_STATUS.SUCCESS,
          interrupt: interruptSummary,
          error: error ? String(error).slice(0, 4000) : null,
          output: result.output,
          endedAt,
          durationMs: endedAt - startedAt,
          usage: result.usage,
          llmCalls: result.llmCalls,
          toolCalls: result.toolCalls,
          toolErrors: result.toolErrors,
          subagentCalls: result.subagentCalls,
          spanCount: result.spans.length,
          truncated: result.truncated,
          ...(result.model ? { model: result.model } : {}),
        });
      } catch (err) {
        logger.warn('[Traces] failed to finish trace', {
          traceId: String(traceId),
          err: err.message,
        });
      }
    };

    return { traceId: String(traceId), recorder, finish };
  }

  /**
   * Starts tracing one Gemini Live voice call (browser, SDK or Twilio).
   * Returns the `tracer` to inject into VoiceSession, or null when the call
   * is not traced (tracing off / Persona domain). VoiceSession calls
   * `tracer.start()` when it starts and `tracer.end({ reason })` on close.
   *
   * @param {object} p
   * @param {object} p.claims     voice ticket claims (domain, agentId, principalType, subjectId, threadId)
   * @param {{callSid?: string, from?: string, channel?: string}} [p.telephony]
   * @returns {null | VoiceCallTracer}
   */
  beginVoice({ claims, agentName, model, provider, voiceName, channel, telephony } = {}) {
    try {
      if (!claims || !this.isEnabledFor({ domain: claims.domain })) return null;
      const traceId = String(traceRepository.newId());
      const audioCfg = config.traces.voiceAudio || {};
      return new VoiceCallTracer({
        traceId,
        repository: traceRepository,
        store: audioCfg.enabled ? traceAudioStore : null,
        maxAudioMinutes: audioCfg.maxMinutes || 15,
        usageMode: config.traces.voiceUsageMode,
        debugUsage: Boolean(config.traces.debugVoiceUsage),
        base: {
          domain: String(claims.domain),
          agentId: String(claims.agentId),
          agentName: agentName || null,
          threadId: claims.threadId ? String(claims.threadId) : null,
          source: claims.principalType === 'ProjectAdmin' ? 'playground' : 'api',
          channel: channel || 'voice',
          endUserId: claims.subjectId ? String(claims.subjectId) : null,
          model: model || null,
          provider: provider || null,
        },
        metadata: {
          voiceName: voiceName || null,
          ...(telephony
            ? {
                telephony: {
                  callSid: telephony.callSid || null,
                  callerPhone: maskPhone(telephony.from),
                  channel: telephony.channel || 'voice',
                },
              }
            : {}),
        },
      });
    } catch (err) {
      logger.warn('[Traces] failed to begin voice trace', { err: err?.message });
      return null;
    }
  }

  /**
   * The call recording of a voice trace, for streaming.
   * @returns {Promise<{key: string, size: number, mimeType: string}>}
   */
  async getAudio(domain, traceId) {
    if (!traceRepository.isValidId(traceId)) throw new NotFoundError('Trace not found', 'Trace');
    const trace = await traceRepository.findAudioMeta({ _id: traceId, domain: String(domain) });
    if (!trace) throw new NotFoundError('Trace not found', 'Trace');
    const audio = trace.audio;
    if (audio?.status === 'recording' || audio?.status === 'processing') {
      throw new BaseError('The recording is not ready yet', 409, 'AUDIO_NOT_READY');
    }
    if (audio?.status !== 'ready' || !audio.storageKey) {
      throw new NotFoundError('This trace has no recording', 'TraceAudio');
    }
    const stat = await traceAudioStore.stat(audio.storageKey);
    if (!stat) throw new NotFoundError('The recording file is gone', 'TraceAudio');
    return { key: audio.storageKey, size: stat.size, mimeType: audio.mimeType || 'audio/wav' };
  }

  openAudioStream(key, range) {
    return traceAudioStore.createReadStream(key, range);
  }

  /**
   * Daily cleanup: recordings past retention or without a trace, stale temp
   * files, and voice traces left `running` by a crash or restart.
   */
  async sweepVoice() {
    const stale = await traceRepository.findStaleVoiceRunning(
      new Date(Date.now() - STALE_VOICE_TRACE_MS)
    );
    for (const t of stale) {
      await traceRepository
        .update(t._id, {
          status: TRACE_STATUS.CANCELLED,
          error: 'Call ended unexpectedly (server restart)',
          ...(t.audio
            ? { audio: { status: 'failed', error: 'Server restarted during the call' } }
            : {}),
        })
        .catch(() => {});
      await traceAudioStore.removeTemp(t._id).catch(() => {});
    }
    const { deleted } = await traceAudioStore.sweep({
      olderThanMs: config.traces.retentionDays * 24 * 60 * 60 * 1000,
      isKnown: (id) => traceRepository.exists(id),
    });
    return { staleTraces: stale.length, deletedFiles: deleted };
  }

  async list(domain, filters, { page = 1, limit = 20 } = {}) {
    const filter = buildFilter(domain, filters);
    const [items, total] = await Promise.all([
      traceRepository.search(filter, { page, limit }),
      traceRepository.count(filter),
    ]);
    return { items, total };
  }

  async get(domain, traceId) {
    if (!traceRepository.isValidId(traceId)) throw new NotFoundError('Trace not found', 'Trace');
    const trace = await traceRepository.findOne({ _id: traceId, domain: String(domain) });
    if (!trace) throw new NotFoundError('Trace not found', 'Trace');
    const spans = await traceRepository.findSpans(trace._id);
    return { trace, spans };
  }

  async stats(domain, { agentId, days = 7 } = {}) {
    const window = Number.parseInt(days, 10) || 7;
    if (window < 1 || window > MAX_STATS_DAYS) {
      throw new ValidationError(`days must be between 1 and ${MAX_STATS_DAYS}`);
    }
    const since = new Date(Date.now() - window * 24 * 60 * 60 * 1000);
    const match = { domain: String(domain), startedAt: { $gte: since } };
    if (agentId) match.agentId = String(agentId);
    const isError = { $cond: [{ $eq: ['$status', TRACE_STATUS.ERROR] }, 1, 0] };

    const [facets] = await traceRepository.aggregateTraces([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                runs: { $sum: 1 },
                errors: { $sum: isError },
                inputTokens: { $sum: '$usage.inputTokens' },
                outputTokens: { $sum: '$usage.outputTokens' },
                totalTokens: { $sum: '$usage.totalTokens' },
                llmCalls: { $sum: '$llmCalls' },
                toolCalls: { $sum: '$toolCalls' },
                avgDurationMs: { $avg: '$durationMs' },
              },
            },
          ],
          byDay: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
                runs: { $sum: 1 },
                errors: { $sum: isError },
                totalTokens: { $sum: '$usage.totalTokens' },
                avgDurationMs: { $avg: '$durationMs' },
              },
            },
            { $sort: { _id: 1 } },
          ],
          byAgent: [
            {
              $group: {
                _id: '$agentId',
                agentName: { $last: '$agentName' },
                runs: { $sum: 1 },
                errors: { $sum: isError },
                totalTokens: { $sum: '$usage.totalTokens' },
                avgDurationMs: { $avg: '$durationMs' },
              },
            },
            { $sort: { runs: -1 } },
            { $limit: 25 },
          ],
          byChannel: [
            {
              $group: {
                _id: { $ifNull: ['$channel', 'web'] },
                runs: { $sum: 1 },
                errors: { $sum: isError },
                totalTokens: { $sum: '$usage.totalTokens' },
              },
            },
            { $sort: { runs: -1 } },
          ],
          voice: [
            { $match: { 'metadata.voice': { $exists: true } } },
            {
              $group: {
                _id: null,
                calls: { $sum: 1 },
                callMs: { $sum: { $ifNull: ['$durationMs', 0] } },
                recordedMs: { $sum: { $ifNull: ['$audio.durationMs', 0] } },
                inAudio: { $sum: { $ifNull: ['$usage.details.input.audio', 0] } },
                inText: { $sum: { $ifNull: ['$usage.details.input.text', 0] } },
                inImage: { $sum: { $ifNull: ['$usage.details.input.image', 0] } },
                outAudio: { $sum: { $ifNull: ['$usage.details.output.audio', 0] } },
                outText: { $sum: { $ifNull: ['$usage.details.output.text', 0] } },
                totalTokens: { $sum: '$usage.totalTokens' },
                interruptions: { $sum: { $ifNull: ['$metadata.voice.interruptions', 0] } },
              },
            },
          ],
          durations: [
            { $match: { durationMs: { $ne: null } } },
            { $sort: { durationMs: 1 } },
            { $limit: 10000 },
            { $project: { _id: 0, d: '$durationMs' } },
          ],
        },
      },
    ]);

    const spanMatch = {
      domain: String(domain),
      startedAt: { $gte: since },
      kind: { $in: ['tool', 'subagent'] },
    };
    if (agentId) spanMatch.agentId = String(agentId);
    const tools = await traceRepository.aggregateSpans([
      { $match: spanMatch },
      {
        $group: {
          _id: '$name',
          kind: { $first: '$kind' },
          calls: { $sum: 1 },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
          avgDurationMs: { $avg: '$durationMs' },
        },
      },
      { $sort: { calls: -1 } },
      { $limit: 25 },
    ]);

    const sorted = (facets?.durations || []).map((r) => r.d);
    const totals = facets?.totals?.[0] || {
      runs: 0,
      errors: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      llmCalls: 0,
      toolCalls: 0,
      avgDurationMs: null,
    };
    delete totals._id;

    // Fill empty days so the chart has a continuous x-axis.
    const dayMap = new Map((facets?.byDay || []).map((d) => [d._id, d]));
    const byDay = [];
    for (let i = window - 1; i >= 0; i -= 1) {
      const key = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const d = dayMap.get(key);
      byDay.push({
        date: key,
        runs: d?.runs || 0,
        errors: d?.errors || 0,
        totalTokens: d?.totalTokens || 0,
        avgDurationMs: d?.avgDurationMs ?? null,
      });
    }

    return {
      days: window,
      totals: {
        ...totals,
        p50DurationMs: percentile(sorted, 50),
        p95DurationMs: percentile(sorted, 95),
      },
      byDay,
      byAgent: (facets?.byAgent || []).map(({ _id, ...rest }) => ({ agentId: _id, ...rest })),
      byChannel: (facets?.byChannel || []).map(({ _id, ...rest }) => ({ channel: _id, ...rest })),
      voice: voiceStats(facets?.voice?.[0]),
      tools: tools.map(({ _id, ...rest }) => ({ name: _id, ...rest })),
    };
  }
}

export default new TraceService();
