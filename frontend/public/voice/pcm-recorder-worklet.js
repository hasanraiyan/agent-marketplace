/**
 * Mic capture worklet for the Developer Studio Voice Test panel
 * (voice-agent-plan.md Section 12). Runs on the audio rendering thread; the
 * AudioContext that loads this must itself be constructed at 16000Hz (the
 * Live API's uplink sample rate) so no resampling happens here — the
 * browser resamples once, at context-construction time.
 *
 * Buffers Float32 samples into 20ms frames (320 samples @ 16kHz), converts
 * to 16-bit PCM, and posts each frame to the main thread as a transferable
 * ArrayBuffer. The main thread forwards it to the WebSocket unchanged —
 * uplink carries no header (voice-agent-plan.md Section 5).
 */
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._chunkSamples = 320;
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this._buffer.push(channel[i]);
      }
      while (this._buffer.length >= this._chunkSamples) {
        const chunk = this._buffer.splice(0, this._chunkSamples);
        const int16 = new Int16Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(int16.buffer, [int16.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("pcm-recorder-processor", PCMRecorderProcessor);
