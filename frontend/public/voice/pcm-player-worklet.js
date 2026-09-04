/**
 * Playback worklet for the Developer Studio Voice Test panel
 * (voice-agent-plan.md Section 12). The AudioContext that loads this must be
 * constructed at the sample rate the server reports in voice_session_ready
 * (24000Hz for the Live API's downlink today).
 *
 * Receives raw 16-bit PCM ArrayBuffers (the 4-byte turnSeq header already
 * stripped by the main thread — see useVoiceSession.js) and queues them for
 * gapless playback. A `{type:'flush'}` message clears the queue instantly,
 * used on barge-in (voice_interrupted) so a superseded agent utterance
 * doesn't keep playing over the user (voice-agent-plan.md Section 11).
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = [];
    this._readOffset = 0;
    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg && msg.type === "flush") {
        this._queue = [];
        this._readOffset = 0;
        return;
      }
      const int16 = new Int16Array(msg);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x8000;
      }
      this._queue.push(float32);
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0][0];
    let outIdx = 0;
    while (outIdx < output.length) {
      if (this._queue.length === 0) {
        output[outIdx++] = 0;
        continue;
      }
      const current = this._queue[0];
      const remaining = current.length - this._readOffset;
      const toCopy = Math.min(remaining, output.length - outIdx);
      output.set(
        current.subarray(this._readOffset, this._readOffset + toCopy),
        outIdx,
      );
      outIdx += toCopy;
      this._readOffset += toCopy;
      if (this._readOffset >= current.length) {
        this._queue.shift();
        this._readOffset = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-player-processor", PCMPlayerProcessor);
