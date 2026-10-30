import assert from 'node:assert';
import { describe, it } from 'vitest';

const { getChannelBadgeLabel } = await import('../dist/index.js');

describe('Channel Badges and Continuity', () => {
  it('exports getChannelBadgeLabel with correct human-friendly strings', () => {
    assert.equal(typeof getChannelBadgeLabel, 'function');
    assert.equal(getChannelBadgeLabel('voice'), 'Transcribed from phone call');
    assert.equal(getChannelBadgeLabel('whatsapp'), 'via WhatsApp');
    assert.equal(getChannelBadgeLabel('sms'), 'via SMS');
    assert.equal(getChannelBadgeLabel('web'), 'Web Chat');
    assert.equal(getChannelBadgeLabel(undefined), 'Web Chat');
  });
});
