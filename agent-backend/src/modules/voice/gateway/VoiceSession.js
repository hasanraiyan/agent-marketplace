import crypto from 'crypto';
import { EventType } from '@ag-ui/core';
import { loggerService } from '../../../utils/index.js';
import { connectGeminiLive } from './geminiLiveClient.js';
import { frameAudioForClient } from './audioFraming.js';
import {
  INPUT_MIME_TYPE,
  INPUT_SAMPLE_RATE,
  OUTPUT_SAMPLE_RATE,
  DEFAULT_MAX_DURATION_MS,
  IDLE_TIMEOUT_MS,
  TOOL_CALL_TIMEOUT_MS,
  CLOSE_REASON,
  END_CALL_TOOL_NAME,
} from '../voice.constants.js';

const logger = loggerService.getLogger();

const IDLE_CHECK_INTERVAL_MS = 5000;
/** Reconnect this much before the server's stated deadline, never negative. */
const GOAWAY_SAFETY_MARGIN_MS = 2000;
const GOAWAY_FALLBACK_DELAY_MS = 3000;

/** Parses a protobuf Duration JSON string ("10s", "1.5s") to milliseconds. */
function parseProtoDurationMs(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) return null;
  return Math.round(parseFloat(match[1]) * 1000);
}

/**
 * One live voice session: bridges one client WebSocket connection to one
 * (possibly several, across transparent reconnects) Gemini Live upstream
 * connection. This is the only file in the voice module that interprets
 * Gemini's message shapes (voice-agent-plan.md Section 6.2) - voiceGateway.js
 * only authenticates and constructs this; voice.service.js only builds the
 * config handed to it.
 *
 * Phase 1 scope (voice-agent-plan.md Section 18): audio in, audio out, live
 * transcription, session resumption, barge-in signaling. Phase 3 added tool
 * calls (buildVoiceLiveConfig declares `tools`, and inbound `toolCall` parts
 * run their LangChain tool here). Phase 4 added thread/checkpoint persistence
 * for machine sessions: the gateway injects an `onTranscriptCommit` sink, and
 * this session fires it on every FINAL transcript line — but persistence is
 * strictly fire-and-forget and never gates audio.
 */
export class VoiceSession {
  /**
   * @param {object} params
   * @param {import('ws').WebSocket} params.clientWs
   * @param {{principalType: string, domain: string, agentId: string, subjectId: string, threadId?: string|null}} params.claims
   * @param {string} params.apiKey - decrypted Gemini API key, held only in memory for this session's lifetime
   * @param {string} params.model
   * @param {string} params.voiceName
   * @param {object} params.liveConfig - base LiveConnectConfig from buildVoiceLiveConfig (no sessionResumption.handle yet)
   * @param {Map<string, *>} params.toolsByName - original (unsanitized) executable LangChain tools, keyed by name - the same tools `liveConfig.tools[0].functionDeclarations` declared from a sanitized copy of (voice-agent-plan.md §9)
   */
  constructor({ clientWs, claims, apiKey, model, voiceName, liveConfig, toolsByName, onTranscriptCommit }) {
    this.clientWs = clientWs;
    this.claims = claims;
    this.apiKey = apiKey;
    this.model = model;
    this.voiceName = voiceName;
    this.liveConfig = liveConfig;
    this.toolsByName = toolsByName || new Map();
    // Phase 4 (voice-agent-plan.md §4.3): optional sink callback fired on
    // every FINAL transcript line (user + agent) so the voice conversation
    // can be persisted to the thread's checkpoint. Injected by the gateway
    // for ProjectRuntime sessions; undefined keeps Studio test sessions
    // fully ephemeral. Fire-and-forget — persistence never gates audio.
    this.onTranscriptCommit = onTranscriptCommit || null;
    /** toolCallId -> {controller: AbortController, cancelled: boolean} */
    this.pendingToolCalls = new Map();
    // No Thread model involvement yet (Phase 4) - this only satisfies the
    // AG-UI RUN_STARTED/RUN_FINISHED event shape's required threadId field,
    // using the same deterministic-id convention projectAgentTest already
    // uses for its own agent-test scratch conversations.
    this.threadId = claims.threadId || `voice-test-${claims.domain}-${claims.agentId}`;

    this.geminiSession = null;
    this.sessionGeneration = 0;
    this.resumptionHandle = null;

    this.turnSeq = 0;
    this.turnActive = false;
    this.runId = null;
    this.agentSpeaking = false;
    // Gemini Live streams an agent utterance's output transcription as several
    // cumulative serverContent snapshots (which may restart/rephrase mid-way)
    // and only closes the turn with turnComplete. Accumulate the LATEST
    // snapshot here and commit ONE transcript line at turnComplete — writing
    // each fragment as its own line is what stuffed the checkpoint with
    // overlapping near-duplicate messages.
    this.pendingAgentText = null;
    this.lastUsage = null;
    // Set once the model calls end_call. Checked at the NEXT turnComplete
    // rather than acted on immediately, so a goodbye the model says after
    // calling the tool still gets fully sent before the session closes.
    this.endCallRequested = false;

    this.startedAt = 0;
    this.lastClientAudioAt = 0;
    this.closed = false;
    this.reconnecting = false;

    this.maxDurationTimer = null;
    this.idleInterval = null;
    this.goAwayTimer = null;
  }

  async start() {
    this.startedAt = Date.now();
    this.lastClientAudioAt = this.startedAt;

    this.clientWs.on('message', (data, isBinary) => this._handleClientMessage(data, isBinary));
    this.clientWs.on('close', () => this._closeSession(CLOSE_REASON.CLIENT_CLOSED));
    this.clientWs.on('error', (err) => {
      logger.warn('[Voice] client socket error', { err: err?.message });
    });

    this.maxDurationTimer = setTimeout(
      () => this._closeSession(CLOSE_REASON.MAX_DURATION),
      DEFAULT_MAX_DURATION_MS
    );
    this.idleInterval = setInterval(() => {
      if (Date.now() - this.lastClientAudioAt > IDLE_TIMEOUT_MS) {
        this._closeSession(CLOSE_REASON.IDLE);
      }
    }, IDLE_CHECK_INTERVAL_MS);

    await this._connectUpstream(null);

    logger.info('[Voice] session started', {
      domain: this.claims.domain,
      agentId: this.claims.agentId,
      model: this.model,
    });
  }

  /** @param {string|null} resumeHandle */
  async _connectUpstream(resumeHandle) {
    const generation = ++this.sessionGeneration;
    const config = {
      ...this.liveConfig,
      // `transparent: true` is Vertex-AI-only ("Gemini Enterprise Agent
      // Platform mode") — the public Developer API (what an API-key-based
      // Gemini provider actually uses, generativelanguage.googleapis.com)
      // rejects it outright: "transparent parameter is only supported in
      // Gemini Enterprise Agent Platform mode, not in Gemini Developer API
      // mode." Confirmed against a live key. Resumption itself (the
      // `handle`) still works without it.
      sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
    };

    const session = await connectGeminiLive({
      apiKey: this.apiKey,
      model: this.model,
      config,
      callbacks: {
        onopen: () => logger.debug('[Voice] upstream opened', { generation }),
        onmessage: (message) => {
          if (generation !== this.sessionGeneration) return; // stale connection, superseded by a reconnect
          this._handleGeminiMessage(message);
        },
        onerror: (e) => {
          if (generation !== this.sessionGeneration) return;
          logger.warn('[Voice] upstream error', { err: e?.message });
        },
        onclose: (e) => {
          if (generation !== this.sessionGeneration) return;
          this._onUpstreamClose(e);
        },
      },
    });

    this.geminiSession = session;
    return session;
  }

  _onUpstreamClose(event) {
    if (this.closed) return; // we tore this down ourselves - already handled
    logger.warn('[Voice] upstream closed unexpectedly, attempting resumption', {
      reason: event?.reason,
    });
    this._reconnectUpstream().catch(() => {});
  }

  async _reconnectUpstream() {
    if (this.closed || this.reconnecting) return;
    this.reconnecting = true;
    try {
      if (!this.resumptionHandle) {
        logger.warn('[Voice] upstream dropped with no usable resumption handle - ending session', {
          domain: this.claims.domain,
          agentId: this.claims.agentId,
        });
        this._closeSession(CLOSE_REASON.UPSTREAM_ERROR);
        return;
      }
      await this._connectUpstream(this.resumptionHandle);
      this._sendCustom('voice_session_resumed', { handle: this.resumptionHandle });
      logger.info('[Voice] transparently reconnected upstream', {
        domain: this.claims.domain,
        agentId: this.claims.agentId,
      });
    } catch (err) {
      logger.error('[Voice] upstream reconnect failed', { err: err?.message });
      this._closeSession(CLOSE_REASON.UPSTREAM_ERROR);
    } finally {
      this.reconnecting = false;
    }
  }

  _handleGoAway(goAway) {
    const parsedMs = parseProtoDurationMs(goAway?.timeLeft);
    const delay = Math.max((parsedMs ?? GOAWAY_FALLBACK_DELAY_MS) - GOAWAY_SAFETY_MARGIN_MS, 0);

    logger.info('[Voice] upstream goAway received, scheduling proactive reconnect', {
      timeLeft: goAway?.timeLeft,
      delayMs: delay,
    });

    if (this.goAwayTimer) clearTimeout(this.goAwayTimer);
    this.goAwayTimer = setTimeout(() => {
      this._reconnectUpstream().catch(() => {});
    }, delay);
  }

  // ---- Gemini -> client -------------------------------------------------

  _handleGeminiMessage(message) {
    if (message.setupComplete) {
      this._sendCustom('voice_session_ready', {
        model: this.model,
        voice: this.voiceName,
        inputSampleRate: INPUT_SAMPLE_RATE,
        outputSampleRate: OUTPUT_SAMPLE_RATE,
        maxDurationMs: DEFAULT_MAX_DURATION_MS,
      });
      return;
    }

    if (message.voiceActivity) {
      const type = message.voiceActivity.voiceActivityType;
      if (type === 'ACTIVITY_START') {
        this._sendCustom('voice_activity', { speaker: 'user', state: 'start' });
        this._beginTurnIfNeeded();
      } else if (type === 'ACTIVITY_END') {
        this._sendCustom('voice_activity', { speaker: 'user', state: 'end' });
      }
    }

    if (message.serverContent) {
      this._handleServerContent(message.serverContent);
    }

    if (message.sessionResumptionUpdate) {
      const { newHandle, resumable } = message.sessionResumptionUpdate;
      // resumable === false is documented specifically for mid-function-call
      // and mid-generation windows (voice-agent-plan.md Section 11) - never
      // overwrite a good handle with one that admits it can't be used.
      if (newHandle && resumable !== false) {
        this.resumptionHandle = newHandle;
      }
    }

    if (message.goAway) {
      this._handleGoAway(message.goAway);
    }

    if (message.usageMetadata) {
      this.lastUsage = message.usageMetadata;
    }

    if (message.toolCall) {
      this._handleToolCall(message.toolCall).catch((err) => {
        logger.error('[Voice] tool call batch failed unexpectedly', { err: err?.message });
      });
    }

    if (message.toolCallCancellation) {
      this._handleToolCallCancellation(message.toolCallCancellation);
    }
  }

  _handleServerContent(content) {
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) {
          this._beginAgentAudioIfNeeded();
          const pcm = Buffer.from(part.inlineData.data, 'base64');
          this._sendAudioFrame(pcm);
        }
      }
    }

    if (content.interimInputTranscription?.text) {
      this._sendCustom('voice_transcript', {
        speaker: 'user',
        text: content.interimInputTranscription.text,
        isFinal: false,
        turnSeq: this.turnSeq,
      });
    }

    if (content.inputTranscription?.text) {
      this._sendCustom('voice_transcript', {
        speaker: 'user',
        text: content.inputTranscription.text,
        isFinal: true,
        turnSeq: this.turnSeq,
      });
      this._sendTextChunk('user', content.inputTranscription.text);
      this._commitTranscript('user', content.inputTranscription.text);
    }

    if (content.outputTranscription?.text) {
      // Each delivery is a cumulative snapshot of the utterance so far (the
      // model may rephrase/restart mid-utterance, so later snapshots supersede
      // earlier ones). Surface it as a growing live partial; the SINGLE final
      // line is emitted and persisted by _flushAgentUtterance() at turnComplete
      // — never one message per fragment.
      this.pendingAgentText = content.outputTranscription.text;
      this._sendCustom('voice_transcript', {
        speaker: 'agent',
        text: this.pendingAgentText,
        isFinal: false,
        turnSeq: this.turnSeq,
      });
    }

    if (content.interrupted) {
      // The agent's utterance was cut off by a barge-in — drop the half-said
      // transcript (it was never completed) rather than persist it as a turn.
      this.pendingAgentText = null;
      // A new "generation" of agent audio starts fresh after a barge-in -
      // bump turnSeq so the client can drop everything tagged with the old
      // one without ambiguity (voice-agent-plan.md Section 5, Section 11).
      this.turnSeq += 1;
      this._sendCustom('voice_interrupted', { turnSeq: this.turnSeq });
    }

    if (content.turnComplete) {
      // The model finished its turn — now the accumulated output transcription
      // is final: emit + persist one clean agent line.
      this._flushAgentUtterance();
      if (this.agentSpeaking) {
        this._sendCustom('voice_activity', { speaker: 'agent', state: 'end' });
        this.agentSpeaking = false;
      }
      this._endTurn();
      this.turnSeq += 1; // next agent utterance is a new generation too

      if (this.endCallRequested) {
        // Wait for THIS turn to fully complete before closing - the model
        // may have said its goodbye after calling end_call, and that audio
        // has just finished sending above.
        this._closeSession(CLOSE_REASON.AGENT_ENDED);
      }
    }
  }

  // ---- tool calls ---------------------------------------------------------

  /**
   * Executes every functionCall in one LiveServerToolCall batch in
   * parallel and replies with exactly one `sendToolResponse` covering all
   * of them (voice-agent-plan.md §9 — "responding piecemeal desynchronizes
   * the model"). Declares against a sanitized tool copy but always
   * executes the ORIGINAL tool from `toolsByName` (never the sanitizer's
   * rebuilt one).
   */
  async _handleToolCall(toolCall) {
    const functionCalls = toolCall.functionCalls || [];
    if (functionCalls.length === 0) return;

    // A tool call always happens within a turn - defensive in case it
    // somehow arrives without a preceding voiceActivity ACTIVITY_START
    // (AG-UI's TOOL_CALL_* events should always fall inside a
    // RUN_STARTED/RUN_FINISHED bracket).
    this._beginTurnIfNeeded();

    const settled = await Promise.all(
      functionCalls.map((fc) => this._invokeToolCallWithTimeout(fc))
    );

    const functionResponses = [];
    for (const entry of settled) {
      if (entry.cancelled) {
        // toolCallCancellation said the server already moved on without
        // this result - per the SDK's own doc comment, it "should have
        // been not executed" from the server's perspective, so we drop it
        // rather than answer a call the model no longer expects a reply to.
        logger.debug('[Voice] dropping result for cancelled tool call', {
          toolCallId: entry.id,
          toolCallName: entry.name,
        });
        continue;
      }

      this._sendRaw({
        type: EventType.TOOL_CALL_RESULT,
        messageId: this.runId || this.threadId,
        toolCallId: entry.id,
        content: JSON.stringify(entry.response),
        role: 'tool',
      });
      functionResponses.push({ id: entry.id, name: entry.name, response: entry.response });
    }

    if (functionResponses.length > 0) {
      this.geminiSession?.sendToolResponse({ functionResponses });
    }
  }

  /**
   * @param {import('@google/genai').FunctionCall} fc
   * @returns {Promise<{id: string, name: string, cancelled: boolean, response: {output?: *, error?: string}}>}
   */
  async _invokeToolCallWithTimeout(fc) {
    const controller = new AbortController();
    const entry = { controller, cancelled: false };
    this.pendingToolCalls.set(fc.id, entry);

    this._sendRaw({
      type: EventType.TOOL_CALL_CHUNK,
      toolCallId: fc.id,
      toolCallName: fc.name,
      parentMessageId: this.runId || this.threadId,
    });

    if (fc.name === END_CALL_TOOL_NAME) {
      // A synthetic, voice-only tool (voice.constants.js) - never in
      // toolsByName, since there's no real LangChain tool object behind
      // it. Acknowledged immediately so the model can keep generating
      // (e.g. its goodbye) in the same turn; the actual close happens at
      // this turn's turnComplete (_handleServerContent).
      this.endCallRequested = true;
      this.pendingToolCalls.delete(fc.id);
      return { id: fc.id, name: fc.name, cancelled: entry.cancelled, response: { output: 'ok' } };
    }

    const tool = this.toolsByName.get(fc.name);
    let timeoutHandle;
    try {
      if (!tool) {
        throw new Error(`Unknown tool "${fc.name}"`);
      }

      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          controller.abort();
          reject(new Error(`Tool call timed out after ${TOOL_CALL_TIMEOUT_MS}ms`));
        }, TOOL_CALL_TIMEOUT_MS);
      });

      // {signal} is best-effort — only the subset of tools that thread
      // config.signal through to their own underlying fetch/HTTP calls
      // actually stop early on abort/timeout. Every tool's result is
      // dropped either way (see the `cancelled` check above and the
      // timeout branch below), so correctness never depends on this.
      const result = await Promise.race([
        tool.invoke(fc.args ?? {}, { signal: controller.signal }),
        timeoutPromise,
      ]);

      return { id: fc.id, name: fc.name, cancelled: entry.cancelled, response: { output: result } };
    } catch (err) {
      logger.warn('[Voice] tool call failed', {
        toolCallName: fc.name,
        toolCallId: fc.id,
        err: err?.message,
      });
      return {
        id: fc.id,
        name: fc.name,
        cancelled: entry.cancelled,
        response: { error: err?.message || String(err) },
      };
    } finally {
      clearTimeout(timeoutHandle);
      this.pendingToolCalls.delete(fc.id);
    }
  }

  _handleToolCallCancellation(cancellation) {
    for (const id of cancellation.ids || []) {
      const pending = this.pendingToolCalls.get(id);
      if (pending) {
        pending.cancelled = true;
        pending.controller.abort();
      }
    }
  }

  _beginTurnIfNeeded() {
    if (this.turnActive) return;
    this.turnActive = true;
    this.runId = crypto.randomUUID();
    this._sendRaw({ type: EventType.RUN_STARTED, threadId: this.threadId, runId: this.runId });
  }

  _endTurn() {
    if (!this.turnActive) return;
    this._sendRaw({ type: EventType.RUN_FINISHED, threadId: this.threadId, runId: this.runId });
    this.turnActive = false;
  }

  _beginAgentAudioIfNeeded() {
    if (this.agentSpeaking) return;
    this.agentSpeaking = true;
    this._sendCustom('voice_activity', { speaker: 'agent', state: 'start' });
  }

  _sendAudioFrame(pcmBuffer) {
    if (this.clientWs.readyState !== this.clientWs.OPEN) return;
    this.clientWs.send(frameAudioForClient(this.turnSeq, pcmBuffer));
  }

  _sendCustom(name, value) {
    this._sendRaw({ type: EventType.CUSTOM, name, value });
  }

  _sendTextChunk(role, delta) {
    this._sendRaw({
      type: EventType.TEXT_MESSAGE_CHUNK,
      messageId: this.runId || this.threadId,
      role,
      delta,
    });
  }

  /**
   * Finalize the accumulated agent utterance (the latest cumulative output
   * transcription snapshot) into ONE transcript line: emit the final caption,
   * the AG-UI text chunk, and the checkpoint commit. Called at turnComplete
   * and, defensively, at session close for an utterance cut off mid-speech.
   */
  _flushAgentUtterance() {
    const text = this.pendingAgentText;
    this.pendingAgentText = null;
    if (!text || !text.trim()) return;
    this._sendCustom('voice_transcript', {
      speaker: 'agent',
      text,
      isFinal: true,
      turnSeq: this.turnSeq,
    });
    this._sendTextChunk('assistant', text);
    this._commitTranscript('assistant', text);
  }

  /** Persist one final transcript line (Phase 4). Never blocks the audio path. */
  _commitTranscript(role, text) {
    if (!this.onTranscriptCommit || typeof text !== 'string' || !text.trim()) return;
    try {
      Promise.resolve(this.onTranscriptCommit(role, text)).catch(() => {});
    } catch {
      // sink already gone — safe to drop
    }
  }

  _sendRaw(event) {
    if (this.clientWs.readyState !== this.clientWs.OPEN) return;
    this.clientWs.send(JSON.stringify(event));
  }

  // ---- client -> Gemini --------------------------------------------------

  _handleClientMessage(data, isBinary) {
    if (isBinary) {
      this.lastClientAudioAt = Date.now();
      this._forwardClientAudio(data);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(data.toString('utf8'));
    } catch {
      return; // malformed control frame - ignore rather than tear down the session
    }

    switch (msg.type) {
      case 'ping':
        this._sendRaw({ type: 'pong' });
        break;
      case 'voice.text':
        if (typeof msg.text === 'string' && msg.text.trim()) {
          this._beginTurnIfNeeded();
          this.geminiSession?.sendRealtimeInput({ text: msg.text });
        }
        break;
      case 'voice.end_turn':
        this.geminiSession?.sendRealtimeInput({ audioStreamEnd: true });
        break;
      case 'voice.start_turn':
        // No explicit action under automatic VAD (Phase 1's only mode) -
        // simply resuming audio frames reopens the stream.
        break;
      case 'voice.interrupt':
        // No-op under automatic VAD: real barge-in is server-detected
        // (serverContent.interrupted fires when Gemini's own VAD notices
        // the user talking over it), not client-cancellable. Manual VAD
        // (voice.turnDetection: 'manual') is a Phase 6 Agent-config field
        // this route doesn't read yet.
        logger.debug('[Voice] voice.interrupt is a no-op under automatic VAD');
        break;
      default:
        break;
    }
  }

  _forwardClientAudio(buffer) {
    if (!this.geminiSession) return;
    this.geminiSession.sendRealtimeInput({
      audio: { data: buffer.toString('base64'), mimeType: INPUT_MIME_TYPE },
    });
  }

  // ---- lifecycle ----------------------------------------------------------

  _closeSession(reason) {
    if (this.closed) return;
    this.closed = true;

    clearTimeout(this.maxDurationTimer);
    clearInterval(this.idleInterval);
    clearTimeout(this.goAwayTimer);

    // Commit anything the agent said that never reached a turnComplete (call
    // ended mid-utterance) so the thread isn't left missing the last line.
    this._flushAgentUtterance();

    if (this.turnActive) this._endTurn();

    const usage = this.lastUsage || {};
    this._sendCustom('voice_session_ended', {
      reason,
      usage: {
        durationMs: Date.now() - this.startedAt,
        inputTokens: usage.promptTokenCount,
        outputTokens: usage.responseTokenCount,
      },
    });

    try {
      this.geminiSession?.close();
    } catch {
      // already gone - fine
    }
    try {
      if (this.clientWs.readyState === this.clientWs.OPEN) {
        this.clientWs.close(1000, reason);
      }
    } catch {
      // already gone - fine
    }

    logger.info('[Voice] session closed', {
      domain: this.claims.domain,
      agentId: this.claims.agentId,
      reason,
      durationMs: Date.now() - this.startedAt,
    });
  }
}

export default VoiceSession;
