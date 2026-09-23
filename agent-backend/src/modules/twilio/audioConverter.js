/**
 * High-performance audio conversion between Twilio telephony and Gemini Multimodal Live API.
 *
 * Twilio Audio Specification:
 * - 8,000 Hz sample rate
 * - 8-bit G.711 µ-law (PCMU)
 * - Mono, 20ms frames (160 bytes per packet)
 *
 * Gemini Live API Audio Specification:
 * - Inbound: 16,000 Hz, 16-bit linear PCM (little-endian), mono
 * - Outbound: 24,000 Hz, 16-bit linear PCM (little-endian), mono
 *
 * Because 16,000 / 8,000 = 2 and 24,000 / 8,000 = 3, sample rate conversions
 * are exact integer ratios (2x upsampling, 3x decimation), allowing exact,
 * drift-free, low-latency DSP in pure Node.js without native C++ compilation.
 */

const TWILIO_SAMPLE_RATE = 8000;
const GEMINI_INPUT_SAMPLE_RATE = 16000;
const GEMINI_OUTPUT_SAMPLE_RATE = 24000;
export const TWILIO_FRAME_SIZE_BYTES = 160; // 20ms of 8kHz 8-bit audio

// Precompute G.711 µ-law to Linear 16-bit PCM lookup table (256 entries = 512 bytes)
const MULAW_TO_PCM16_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const mu = ~i & 0xff;
  const sign = mu & 0x80 ? -1 : 1;
  const exponent = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  MULAW_TO_PCM16_TABLE[i] = sign * sample;
}

// Helper to compute a single 16-bit linear PCM sample to 8-bit µ-law byte
function encodeSampleToMulaw(pcmSample) {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = (pcmSample >> 8) & 0x80;
  if (sign !== 0) pcmSample = -pcmSample;
  if (pcmSample > CLIP) pcmSample = CLIP;
  pcmSample += BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (pcmSample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  const mantissa = (pcmSample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

// Precompute Linear 16-bit PCM to µ-law lookup table (65,536 entries = 64 KB)
// Index: sample + 32768
const PCM16_TO_MULAW_TABLE = new Uint8Array(65536);
for (let s = -32768; s <= 32767; s++) {
  PCM16_TO_MULAW_TABLE[s + 32768] = encodeSampleToMulaw(s);
}

/**
 * Converts Twilio inbound 8kHz µ-law audio to Gemini 16kHz PCM16 (LE).
 * Upsamples 1:2 using linear interpolation.
 *
 * @param {Buffer} mulawBuffer - Raw 8kHz µ-law buffer
 * @returns {Buffer} - 16kHz 16-bit LE PCM buffer (4x byte size of input)
 */
export function twilioMulawToGeminiPcm16(mulawBuffer) {
  if (!mulawBuffer || mulawBuffer.length === 0) {
    return Buffer.alloc(0);
  }

  const inLength = mulawBuffer.length;
  // Each µ-law byte expands to one 16-bit PCM sample (2 bytes) at 8kHz.
  // Resampling 1:2 doubles the samples -> inLength * 2 samples -> inLength * 4 bytes.
  const outBuffer = Buffer.alloc(inLength * 4);

  // Decode first sample
  let prevSample = MULAW_TO_PCM16_TABLE[mulawBuffer[0]];

  for (let i = 0; i < inLength; i++) {
    const currSample = MULAW_TO_PCM16_TABLE[mulawBuffer[i]];
    // Linear interpolation for the sample between prevSample and currSample
    const interpolated = Math.round((prevSample + currSample) / 2);

    const outOffset = i * 4;
    // Write sample 2*i
    outBuffer.writeInt16LE(interpolated, outOffset);
    // Write sample 2*i + 1
    outBuffer.writeInt16LE(currSample, outOffset + 2);

    prevSample = currSample;
  }

  return outBuffer;
}

/**
 * Converts Gemini outbound 24kHz PCM16 (LE) audio to Twilio 8kHz µ-law.
 * Decimates 3:1 using a 3-tap low-pass average filter to prevent aliasing.
 *
 * @param {Buffer} pcm24kBuffer - 24kHz 16-bit LE PCM buffer
 * @returns {Buffer} - 8kHz µ-law buffer (1/6 byte size of input)
 */
export function geminiPcm24kToTwilioMulaw(pcm24kBuffer) {
  if (!pcm24kBuffer || pcm24kBuffer.length < 2) {
    return Buffer.alloc(0);
  }

  const sampleCount = Math.floor(pcm24kBuffer.length / 2);
  const outSampleCount = Math.floor(sampleCount / 3);
  const outMulaw = Buffer.alloc(outSampleCount);

  for (let i = 0; i < outSampleCount; i++) {
    const idx = i * 3;
    const s1 = pcm24kBuffer.readInt16LE(idx * 2);
    const s2 = pcm24kBuffer.readInt16LE((idx + 1) * 2);
    const s3 = pcm24kBuffer.readInt16LE((idx + 2) * 2);

    // 3-point moving average filter
    const avgSample = Math.round((s1 + s2 + s3) / 3);
    const clamped = Math.max(-32768, Math.min(32767, avgSample));

    outMulaw[i] = PCM16_TO_MULAW_TABLE[clamped + 32768];
  }

  return outMulaw;
}

/**
 * Chunks a µ-law buffer into 160-byte (20ms) slices for Twilio Media Streams.
 * Returns leftover bytes that did not form a complete 160-byte chunk.
 *
 * @param {Buffer} buffer - Accumulated µ-law buffer
 * @returns {{ chunks: Buffer[], remainder: Buffer }}
 */
export function chunkMulawForTwilio(buffer) {
  const chunks = [];
  let offset = 0;

  while (offset + TWILIO_FRAME_SIZE_BYTES <= buffer.length) {
    chunks.push(buffer.subarray(offset, offset + TWILIO_FRAME_SIZE_BYTES));
    offset += TWILIO_FRAME_SIZE_BYTES;
  }

  const remainder = offset < buffer.length ? buffer.subarray(offset) : Buffer.alloc(0);
  return { chunks, remainder };
}

export default {
  TWILIO_SAMPLE_RATE,
  GEMINI_INPUT_SAMPLE_RATE,
  GEMINI_OUTPUT_SAMPLE_RATE,
  TWILIO_FRAME_SIZE_BYTES,
  twilioMulawToGeminiPcm16,
  geminiPcm24kToTwilioMulaw,
  chunkMulawForTwilio,
};
