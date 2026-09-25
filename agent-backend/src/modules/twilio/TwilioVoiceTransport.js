import { EventEmitter } from 'events';
import { loggerService } from '../../utils/index.js';
import {
  twilioMulawToGeminiPcm16,
  geminiPcm24kToTwilioMulaw,
  chunkMulawForTwilio,
  TWILIO_FRAME_SIZE_BYTES,
} from './audioConverter.js';

const logger = loggerService.getLogger();

// WebSocket readyState constants
const WS_OPEN = 1;
const WS_CLOSED = 3;

// 20ms pacing interval (Twilio 160 bytes @ 8kHz)
const PACING_INTERVAL_MS = 20;
// Maximum allowed buffered audio chunks before dropping stale chunks (5s of audio @ 20ms)
export const MAX_OUTBOUND_QUEUE_CHUNKS = 250;

/**
 * TwilioVoiceTransport implements the client socket interface expected by
 * VoiceSession (on, send, close, readyState), bridging between Twilio Media Streams
 * and Gemini Multimodal Live API.
 */
export class TwilioVoiceTransport extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  /**
   * @param {object} params
   * @param {import('ws').WebSocket} params.twilioWs - Twilio Media Stream WebSocket
   * @param {string} [params.streamSid] - Optional initial streamSid if known
   * @param {string} [params.callSid] - Optional initial callSid if known
   */
  constructor({ twilioWs, streamSid = null, callSid = null }) {
    super();
    this.twilioWs = twilioWs;
    this.streamSid = streamSid;
    this.callSid = callSid;

    this.acceptedTurnSeq = 0;
    this.closed = false;

    // Buffer for outgoing audio chunks to pace them smoothly to Twilio
    this.outboundMulawQueue = [];
    this.mulawRemainder = Buffer.alloc(0);
    this.pacingTimer = null;

    // Audio metrics & diagnostic counters
    this.inboundAudioPackets = 0;
    this.outboundAudioFrames = 0;
    this.sentMediaChunks = 0;

    this._setupTwilioSocket();
    this._startPacingTimer();
  }

  get readyState() {
    if (this.closed) return this.CLOSED;
    return this.twilioWs ? this.twilioWs.readyState : this.CLOSED;
  }

  _setupTwilioSocket() {
    this.twilioWs.on('message', (data) => {
      this._handleTwilioMessage(data);
    });

    this.twilioWs.on('close', (code, reason) => {
      logger.info('[TwilioTransport] Twilio WebSocket closed', { code, streamSid: this.streamSid });
      this._teardown();
      this.emit('close', code, reason);
    });

    this.twilioWs.on('error', (err) => {
      logger.warn('[TwilioTransport] Twilio WebSocket error', { err: err?.message });
      this.emit('error', err);
    });
  }

  _startPacingTimer() {
    this.pacingTimer = setInterval(() => {
      if (this.outboundMulawQueue.length > 0 && this.twilioWs?.readyState === this.OPEN) {
        const chunk = this.outboundMulawQueue.shift();
        this._sendMediaToTwilio(chunk);
      }
    }, PACING_INTERVAL_MS);
  }

  _handleTwilioMessage(data) {
    let msg;
    try {
      msg = JSON.parse(data.toString('utf8'));
    } catch (err) {
      logger.warn('[TwilioTransport] Failed to parse Twilio message', { err: err?.message });
      return;
    }

    switch (msg.event) {
      case 'connected':
        logger.debug('[TwilioTransport] Twilio connected event received');
        break;

      case 'start':
        this.streamSid = msg.start?.streamSid || msg.streamSid;
        this.callSid = msg.start?.callSid || msg.callSid;
        logger.info('[TwilioTransport] Twilio stream started', {
          streamSid: this.streamSid,
          callSid: this.callSid,
          customParameters: msg.start?.customParameters,
        });
        this.emit('stream_started', {
          streamSid: this.streamSid,
          callSid: this.callSid,
          customParameters: msg.start?.customParameters || {},
        });
        break;

      case 'media': {
        // Inbound audio from caller: 8kHz mu-law in base64
        const payloadBase64 = msg.media?.payload;
        if (!payloadBase64) return;

        const mulawBuffer = Buffer.from(payloadBase64, 'base64');
        if (mulawBuffer.length === 0) return;

        this.inboundAudioPackets++;
        if (this.inboundAudioPackets === 1 || this.inboundAudioPackets % 200 === 0) {
          logger.info('[TwilioTransport] Inbound audio received from caller phone (Twilio -> Gemini)', {
            packetCount: this.inboundAudioPackets,
            bytes: mulawBuffer.length,
            streamSid: this.streamSid,
          });
        }

        // Convert 8kHz mu-law to 16kHz linear PCM16 (LE) for Gemini Live
        const pcm16Buffer = twilioMulawToGeminiPcm16(mulawBuffer);

        // VoiceSession expects: emit('message', buffer, isBinary=true)
        this.emit('message', pcm16Buffer, true);
        break;
      }

      case 'stop':
        logger.info('[TwilioTransport] Twilio stop event received', { streamSid: this.streamSid });
        this._teardown();
        this.emit('close', 1000, 'twilio_stop');
        break;

      case 'mark':
        // Optional synchronization mark
        break;

      default:
        break;
    }
  }

  /**
   * Called by VoiceSession to send audio frames or AG-UI events.
   * Satisfies clientWs.send(data).
   */
  send(data) {
    if (this.closed || !this.twilioWs || this.twilioWs.readyState !== this.OPEN) {
      return;
    }

    if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
      this._handleOutboundAudioFrame(Buffer.from(data));
      return;
    }

    if (typeof data === 'string') {
      this._handleControlEvent(data);
    }
  }

  /**
   * Processes outbound audio from Gemini:
   * 4-byte LE turnSeq header + 24kHz PCM16 payload
   */
  _handleOutboundAudioFrame(buffer) {
    if (buffer.length <= 4) return;

    // Read 4-byte turnSeq header
    const turnSeq = buffer.readUInt32LE(0);

    // If turnSeq is older than our accepted turnSeq (barge-in cut it off), drop it
    if (turnSeq < this.acceptedTurnSeq) {
      return;
    }

    this.acceptedTurnSeq = turnSeq;
    const pcm24k = buffer.subarray(4);

    // Convert 24kHz PCM16 to 8kHz mu-law
    const mulaw = geminiPcm24kToTwilioMulaw(pcm24k);
    if (mulaw.length === 0) return;

    // Combine with remainder from previous packet
    const combined = Buffer.concat([this.mulawRemainder, mulaw]);
    const { chunks, remainder } = chunkMulawForTwilio(combined);
    this.mulawRemainder = remainder;

    this.outboundAudioFrames++;
    if (this.outboundAudioFrames === 1 || this.outboundAudioFrames % 50 === 0) {
      logger.info('[TwilioTransport] Outbound audio received from Gemini (Gemini -> Twilio)', {
        frameCount: this.outboundAudioFrames,
        pcmBytes: pcm24k.length,
        mulawBytes: mulaw.length,
        queuedChunks: this.outboundMulawQueue.length + chunks.length,
        streamSid: this.streamSid,
      });
    }

    // Push into outbound pacing queue
    for (const chunk of chunks) {
      this.outboundMulawQueue.push(chunk);
    }

    // Adaptive queue watermark: drop oldest chunks if queue exceeds cap to eliminate audio lag
    while (this.outboundMulawQueue.length > MAX_OUTBOUND_QUEUE_CHUNKS) {
      this.outboundMulawQueue.shift();
    }
  }

  /**
   * Processes AG-UI control events emitted by VoiceSession
   */
  _handleControlEvent(jsonString) {
    let event;
    try {
      event = JSON.parse(jsonString);
    } catch {
      return;
    }

    if (event.type === 'CUSTOM') {
      if (event.name === 'voice_session_ready') {
        logger.info('[TwilioTransport] Gemini session ready! Triggering proactive initial greeting', {
          streamSid: this.streamSid,
          model: event.value?.model,
        });

        // Trigger Gemini to proactively speak to the caller
        setTimeout(() => {
          if (!this.closed && this.readyState === this.OPEN) {
            logger.info('[TwilioTransport] Sending initial turn to Gemini to introduce itself');
            this.emit(
              'message',
              JSON.stringify({
                type: 'voice.text',
                text: 'Hello! Greet the caller warmly, introduce yourself briefly in one sentence, and ask how you can help them today.',
              }),
              false
            );
          }
        }, 500);
      } else if (event.name === 'voice_transcript') {
        if (event.value?.isFinal) {
          logger.info('[TwilioTransport] Voice transcript', {
            speaker: event.value?.speaker,
            text: event.value?.text,
          });
        }
      } else if (event.name === 'voice_interrupted') {
        // User barged in over the agent!
        this.acceptedTurnSeq = event.value?.turnSeq ?? this.acceptedTurnSeq + 1;
        // 1. Clear our local unplayed audio queue
        this.outboundMulawQueue = [];
        this.mulawRemainder = Buffer.alloc(0);

        // 2. Tell Twilio to clear its audio playback buffer immediately
        this._sendClearToTwilio();
        logger.info('[TwilioTransport] Sent clear to Twilio on barge-in', {
          turnSeq: this.acceptedTurnSeq,
          streamSid: this.streamSid,
        });
      } else if (event.name === 'voice_session_ended') {
        logger.info('[TwilioTransport] Voice session ended', {
          reason: event.value?.reason,
          streamSid: this.streamSid,
        });
        // Allow a small grace period for the final goodbye audio to flush out
        setTimeout(() => {
          this.close(1000, event.value?.reason || 'voice_session_ended');
        }, 800);
      }
    }
  }

  _sendMediaToTwilio(mulawChunk) {
    if (!this.streamSid || this.twilioWs?.readyState !== this.OPEN) return;

    this.sentMediaChunks++;
    if (this.sentMediaChunks === 1 || this.sentMediaChunks % 250 === 0) {
      logger.info('[TwilioTransport] Streaming audio to Twilio caller speaker', {
        sentChunks: this.sentMediaChunks,
        queuedRemaining: this.outboundMulawQueue.length,
        streamSid: this.streamSid,
      });
    }

    const payload = mulawChunk.toString('base64');
    const msg = {
      event: 'media',
      streamSid: this.streamSid,
      media: { payload },
    };

    try {
      this.twilioWs.send(JSON.stringify(msg));
    } catch (err) {
      logger.warn('[TwilioTransport] Failed to send media chunk to Twilio', { err: err?.message });
    }
  }

  _sendClearToTwilio() {
    if (!this.streamSid || this.twilioWs?.readyState !== WS_OPEN) return;

    const msg = {
      event: 'clear',
      streamSid: this.streamSid,
    };

    try {
      this.twilioWs.send(JSON.stringify(msg));
    } catch (err) {
      logger.warn('[TwilioTransport] Failed to send clear to Twilio', { err: err?.message });
    }
  }

  close(code = 1000, reason = 'normal_closure') {
    if (this.closed) return;
    this.closed = true;
    this._teardown();

    try {
      if (this.twilioWs?.readyState === WS_OPEN) {
        this.twilioWs.close(code, reason);
      }
    } catch {
      // ignore
    }

    this.emit('close', code, reason);
  }

  _teardown() {
    if (this.pacingTimer) {
      clearInterval(this.pacingTimer);
      this.pacingTimer = null;
    }
    this.outboundMulawQueue = [];
    this.mulawRemainder = Buffer.alloc(0);
  }
}

export default TwilioVoiceTransport;
