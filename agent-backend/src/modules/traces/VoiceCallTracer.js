import { loggerService } from '../../utils/index.js';
import { TRACE_STATUS } from './trace.model.js';
import { VoiceTraceRecorder } from './VoiceTraceRecorder.js';
import { VoiceAudioRecorder } from './VoiceAudioRecorder.js';
import { mixToStereoWav } from './traceAudioMix.js';

const logger = loggerService.getLogger();

const FLUSH_INTERVAL_MS = 15000;
const FLUSH_EVERY_TURNS = 3;

/** VoiceSession CLOSE_REASON value → trace status. */
export function statusForCloseReason(reason) {
  switch (reason) {
    case 'agent_ended':
    case 'client_closed':
      return TRACE_STATUS.SUCCESS;
    case 'upstream_error':
      return TRACE_STATUS.ERROR;
    case 'idle':
    case 'max_duration':
      return TRACE_STATUS.CANCELLED;
    default:
      return TRACE_STATUS.SUCCESS;
  }
}

/**
 * The one object a VoiceSession talks to while a call is traced (injected
 * as `tracer`). It feeds the in-memory VoiceTraceRecorder, the optional
 * VoiceAudioRecorder, and writes to MongoDB in the background:
 *   - trace row created at start (status `running`)
 *   - closed steps + running totals flushed every few turns / 15 s
 *   - final totals at end(), then the recording is mixed and marked ready
 *
 * Every write is fire-and-forget and serialized on one promise chain, so
 * nothing here can block or break the live audio. VoiceSession also wraps
 * each call in try/catch.
 */
export class VoiceCallTracer {
  /**
   * @param {object} p
   * @param {string} p.traceId
   * @param {object} p.base       fields for the trace row (domain, agentId, …)
   * @param {object} p.repository traceRepository (injectable)
   * @param {object} [p.store]    traceAudioStore, or null when not recording
   * @param {object} [p.metadata] initial metadata.voice (voiceName, telephony)
   */
  constructor({
    traceId,
    base,
    repository,
    store = null,
    maxAudioMinutes = 15,
    usageMode = 'auto',
    debugUsage = false,
    metadata = {},
    now = () => Date.now(),
    flushIntervalMs = FLUSH_INTERVAL_MS,
    openStream,
    mix = mixToStereoWav,
  }) {
    this.traceId = String(traceId);
    this.base = base;
    this.repo = repository;
    this.store = store;
    this.now = now;
    this.debugUsage = debugUsage;
    this.voiceMeta = { ...metadata };
    this.mix = mix;
    this.startedAt = null;
    this.audio = store
      ? new VoiceAudioRecorder({
          paths: store.tempPaths(this.traceId),
          maxMinutes: maxAudioMinutes,
          now,
          ...(openStream ? { openStream } : {}),
        })
      : null;
    this.recorder = new VoiceTraceRecorder({
      model: base.model,
      provider: base.provider,
      usageMode,
      now,
      timelineMs: () => (this.startedAt == null ? 0 : this.now() - this.startedAt),
    });
    this.chain = Promise.resolve(true);
    this.created = null;
    this.turnsSinceFlush = 0;
    this.flushTimer = null;
    this.flushIntervalMs = flushIntervalMs;
    this.ended = false;
  }

  get recording() {
    return Boolean(this.audio);
  }

  _enqueue(label, fn) {
    this.chain = this.chain.then(async (ok) => {
      if (!ok) return false;
      try {
        await fn();
        return true;
      } catch (err) {
        logger.warn(`[Traces] voice ${label} failed`, { traceId: this.traceId, err: err?.message });
        return label !== 'create';
      }
    });
    return this.chain;
  }

  // ── lifecycle ──────────────────────────────────────────────────────────

  start() {
    if (this.startedAt != null) return;
    this.startedAt = this.now();
    if (this.audio) {
      try {
        this.store.ensureDirSync?.();
      } catch {
        // stream open will fail and mark the recorder failed
      }
      this.audio.start(this.startedAt);
    }
    this._enqueue('create', () =>
      this.repo.create({
        _id: this.traceId,
        ...this.base,
        channel: this.base.channel || 'voice',
        status: TRACE_STATUS.RUNNING,
        startedAt: new Date(this.startedAt),
        audio: this.audio ? { status: 'recording' } : null,
        metadata: { voice: this.voiceMeta },
      })
    );
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    this.flushTimer.unref?.();
  }

  flush({ final = false } = {}) {
    const spans = this.recorder.drainClosed({ final });
    const totals = this.recorder.totals();
    this.turnsSinceFlush = 0;
    return this._enqueue('flush', async () => {
      if (spans.length) await this.repo.insertSpans(spans.map((s) => this._row(s)));
      if (!final) {
        await this.repo.update(this.traceId, {
          usage: totals.usage,
          llmCalls: totals.llmCalls,
          toolCalls: totals.toolCalls,
          toolErrors: totals.toolErrors,
          spanCount: totals.spanCount,
          input: totals.input,
          output: totals.output,
          metadata: { voice: { ...this.voiceMeta, ...totals.voice } },
        });
      }
    });
  }

  _row(s) {
    return {
      ...s,
      traceId: this.traceId,
      domain: this.base.domain,
      agentId: this.base.agentId,
      startedAt: new Date(s.startedAt),
      endedAt: s.endedAt ? new Date(s.endedAt) : null,
    };
  }

  /**
   * @param {{reason?: string, error?: string, durationMs?: number}} p
   * @returns {Promise<void>} resolves once the trace (and recording) are final
   */
  async end({ reason, error } = {}) {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.flushTimer);
    const endedAt = this.now();
    const status = statusForCloseReason(reason);
    this.flush({ final: true });
    const totals = this.recorder.totals();
    const audioStop = this.audio ? this.audio.stop() : Promise.resolve(null);
    const audioSummary = await audioStop.catch(() => null);
    const voice = {
      ...this.voiceMeta,
      ...totals.voice,
      endReason: reason || null,
      durationMs: endedAt - (this.startedAt ?? endedAt),
      ...(audioSummary?.droppedAgentMs ? { droppedAgentMs: audioSummary.droppedAgentMs } : {}),
    };
    const hasAudio = this.audio && !audioSummary?.failed;
    await this._enqueue('finish', () =>
      this.repo.update(this.traceId, {
        status,
        error: error ? String(error).slice(0, 4000) : status === TRACE_STATUS.ERROR ? reason : null,
        input: totals.input,
        output: totals.output,
        endedAt: new Date(endedAt),
        durationMs: endedAt - (this.startedAt ?? endedAt),
        usage: totals.usage,
        llmCalls: totals.llmCalls,
        toolCalls: totals.toolCalls,
        toolErrors: totals.toolErrors,
        spanCount: totals.spanCount,
        truncated: totals.truncated,
        metadata: { voice },
        ...(this.audio
          ? {
              audio: hasAudio
                ? { status: 'processing' }
                : { status: 'failed', error: audioSummary?.failed?.message || 'Recording failed' },
            }
          : {}),
      })
    );
    if (hasAudio) await this._finalizeAudio(audioSummary);
  }

  async _finalizeAudio(summary) {
    const paths = this.store.tempPaths(this.traceId);
    const key = this.store.keyFor(this.traceId);
    let audio;
    try {
      const result = await this.mix({
        userPath: paths.user,
        agentPath: paths.agent,
        outPath: this.store.pathForKey(key),
      });
      audio = result
        ? {
            status: 'ready',
            storageKey: key,
            mimeType: 'audio/wav',
            durationMs: result.durationMs,
            bytes: result.bytes,
            sampleRate: result.sampleRate,
            channels: { left: 'user', right: 'agent' },
            truncated: Boolean(summary?.truncated),
          }
        : { status: 'none' };
    } catch (err) {
      audio = { status: 'failed', error: err?.message || 'Mixing failed' };
    }
    if (result) await this.store.finalizeWav?.(this.traceId).catch(() => {});
    await this.store.removeTemp(this.traceId).catch(() => {});
    await this._enqueue('audio', () => this.repo.update(this.traceId, { audio }));
  }

  // ── events from VoiceSession ───────────────────────────────────────────

  turnStart(runId) {
    this.recorder.turnStart(runId);
  }

  turnEnd() {
    this.recorder.turnEnd();
    this.turnsSinceFlush += 1;
    if (this.turnsSinceFlush >= FLUSH_EVERY_TURNS) this.flush();
  }

  userSpeechStart() {
    this.recorder.userSpeechStart();
  }

  userSpeechEnd() {
    this.recorder.userSpeechEnd();
  }

  userAudio(buf) {
    this.audio?.user(buf);
  }

  agentAudio(buf) {
    const placed = this.audio ? this.audio.agent(buf) : null;
    this.recorder.agentAudio(placed);
  }

  userSaid(text, opts) {
    this.recorder.userSaid(text, opts);
  }

  agentSaid(text, opts) {
    this.recorder.agentSaid(text, opts);
  }

  interrupted() {
    const before = this.audio?.droppedAgentMs || 0;
    this.audio?.interrupt();
    const dropped = (this.audio?.droppedAgentMs || 0) - before;
    this.recorder.interrupted({ droppedAgentMs: dropped || undefined });
  }

  reconnected() {
    this.recorder.reconnected();
  }

  toolStart(fc, opts) {
    this.recorder.toolStart(fc, opts);
  }

  toolCallbacks(toolCallId) {
    return this.recorder.toolCallbacks(toolCallId);
  }

  toolEnd(toolCallId, result) {
    this.recorder.toolEnd(toolCallId, result);
  }

  usage(usageMetadata) {
    if (this.debugUsage) {
      logger.info('[Traces] voice usageMetadata (debug)', {
        traceId: this.traceId,
        turn: this.recorder.turn?.metadata?.turn ?? null,
        usage: usageMetadata,
      });
    }
    this.recorder.usage(usageMetadata);
  }

  /** Summed call usage for the `voice_session_ended` event. */
  sessionEndedUsage() {
    return this.recorder.meter.sessionEndedUsage();
  }
}

export default VoiceCallTracer;
