import config from '../../config/index.js';
import { loggerService } from '../../utils/index.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import { PERSONA_DOMAIN } from '../auth/personaPrincipalContext.js';
import { PROJECT_ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import traceRepository from './trace.repository.js';
import { TRACE_STATUS } from './trace.model.js';
import { TraceRecorder } from './TraceRecorder.js';

const logger = loggerService.getLogger();

const MAX_STATS_DAYS = 90;

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

function buildFilter(domain, filters = {}) {
  const filter = { domain: String(domain) };
  if (filters.agentId) filter.agentId = String(filters.agentId);
  if (filters.threadId) filter.threadId = String(filters.threadId);
  if (filters.status && Object.values(TRACE_STATUS).includes(filters.status)) {
    filter.status = filters.status;
  }
  if (filters.source) filter.source = String(filters.source);
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
  begin({ executionContext, agentId, agentConfig, providerConfig, threadId, channel, input }) {
    if (!this.isEnabledFor(executionContext)) return null;

    const traceId = traceRepository.newId();
    const recorder = new TraceRecorder();
    const startedAt = new Date();
    const domain = String(executionContext.domain);

    const created = traceRepository
      .create({
        _id: traceId,
        domain,
        agentId: String(agentId),
        agentName:
          agentConfig?.name ||
          (String(agentId) === PROJECT_ARCHITECT_AGENT_ID ? 'Architect' : null),
        threadId: threadId ? String(threadId) : null,
        source: sourceFor(agentId, executionContext),
        channel: channel || 'web',
        endUserId: endUserFor(executionContext),
        status: TRACE_STATUS.RUNNING,
        model: providerConfig?.modelName || agentConfig?.modelName || null,
        provider: providerConfig?.label || null,
        input: typeof input === 'string' ? input.slice(0, 16000) : null,
        startedAt,
      })
      .then(() => true)
      .catch((err) => {
        logger.warn('[Traces] failed to create trace', { domain, agentId, err: err.message });
        return false;
      });

    let finished = false;
    const finish = async ({ status, error } = {}) => {
      if (finished) return;
      finished = true;
      try {
        if (!(await created)) return;
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
          error: error ? String(error).slice(0, 4000) : null,
          output: result.output,
          endedAt,
          durationMs: endedAt - startedAt,
          usage: result.usage,
          llmCalls: result.llmCalls,
          toolCalls: result.toolCalls,
          toolErrors: result.toolErrors,
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
      tools: tools.map(({ _id, ...rest }) => ({ name: _id, ...rest })),
    };
  }
}

export default new TraceService();
