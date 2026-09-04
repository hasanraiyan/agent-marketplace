/**
 * AudioWorklet processor source for `useVoice`, embedded as strings rather
 * than shipped as separate static files. A consumer app has no `/public`
 * directory we can rely on being copied into (unlike our own first-party
 * frontend, which loads these from `/voice/*.js`) — `URL.createObjectURL`
 * + a Blob is the standard way to hand `audioWorklet.addModule()` a module
 * with zero setup required from the host app.
 */

const RECORDER_WORKLET_SOURCE = `
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._chunkSamples = 320; // 20ms @ 16kHz
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

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
`;

const PLAYER_WORKLET_SOURCE = `
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = [];
    this._readOffset = 0;
    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg && msg.type === 'flush') {
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
      output.set(current.subarray(this._readOffset, this._readOffset + toCopy), outIdx);
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

registerProcessor('pcm-player-processor', PCMPlayerProcessor);
`;

function toModuleUrl(source: string): string {
  const blob = new Blob([source], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

export function recorderWorkletUrl(): string {
  return toModuleUrl(RECORDER_WORKLET_SOURCE);
}

export function playerWorkletUrl(): string {
  return toModuleUrl(PLAYER_WORKLET_SOURCE);
}
