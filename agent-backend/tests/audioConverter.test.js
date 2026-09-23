import {
  twilioMulawToGeminiPcm16,
  geminiPcm24kToTwilioMulaw,
  chunkMulawForTwilio,
  TWILIO_FRAME_SIZE_BYTES,
} from '../src/modules/twilio/audioConverter.js';

describe('Twilio Audio Converter', () => {
  test('converts 8kHz mu-law to 16kHz PCM16 with exact 4x byte expansion', () => {
    // 160 bytes of 8kHz mu-law (20ms)
    const mulaw = Buffer.alloc(160, 0xff); // 0xff is silence in mu-law
    const pcm16 = twilioMulawToGeminiPcm16(mulaw);

    // 160 samples * 2 (upsampling) = 320 samples * 2 bytes = 640 bytes
    expect(pcm16.length).toBe(640);
  });

  test('converts 24kHz PCM16 to 8kHz mu-law with exact 1/6 byte reduction', () => {
    // 480 samples of 24kHz PCM16 = 960 bytes (20ms at 24kHz)
    const pcm24k = Buffer.alloc(960);
    // Fill with a sine-like pattern
    for (let i = 0; i < 480; i++) {
      const val = Math.round(10000 * Math.sin((2 * Math.PI * i) / 50));
      pcm24k.writeInt16LE(val, i * 2);
    }

    const mulaw = geminiPcm24kToTwilioMulaw(pcm24k);
    // 480 samples / 3 = 160 samples = 160 bytes of mu-law (20ms at 8kHz)
    expect(mulaw.length).toBe(160);
  });

  test('chunks mu-law buffer into 160-byte Twilio packets', () => {
    const raw = Buffer.alloc(350); // 160 + 160 + 30
    const { chunks, remainder } = chunkMulawForTwilio(raw);

    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(TWILIO_FRAME_SIZE_BYTES);
    expect(chunks[1].length).toBe(TWILIO_FRAME_SIZE_BYTES);
    expect(remainder.length).toBe(30);
  });
});
