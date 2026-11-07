import { describe, expect, it } from 'vitest';
import { VOICE_IMAGE_LIMITS, voiceImageMessage } from '../src/index.js';

describe('voiceImageMessage', () => {
  it('builds an inline image message with optional caption and name', () => {
    expect(voiceImageMessage('i1', { data: 'QUJD' }, { text: 'What is this?', name: 'a.jpg' })).toEqual({
      type: 'voice.image',
      id: 'i1',
      data: 'QUJD',
      text: 'What is this?',
      name: 'a.jpg',
    });
  });

  it('builds a fileId message and leaves out empty options', () => {
    expect(voiceImageMessage('i2', { fileId: 'f1' })).toEqual({ type: 'voice.image', id: 'i2', fileId: 'f1' });
  });

  it('exposes the voice limits', () => {
    expect(VOICE_IMAGE_LIMITS.mimeTypes).toEqual(['image/jpeg', 'image/png']);
    expect(VOICE_IMAGE_LIMITS.minIntervalMs).toBe(1000);
  });
});
