import { VoiceUsageMeter, normalizeUsage } from '../src/modules/traces/VoiceUsageMeter.js';

const msg = (prompt, response, extra = {}) => ({
  promptTokenCount: prompt,
  responseTokenCount: response,
  totalTokenCount: prompt + response,
  ...extra,
});

describe('normalizeUsage', () => {
  test('reads every Gemini Live field, including the breakdown by type', () => {
    const n = normalizeUsage({
      promptTokenCount: 100,
      responseTokenCount: 40,
      toolUsePromptTokenCount: 10,
      thoughtsTokenCount: 5,
      cachedContentTokenCount: 20,
      totalTokenCount: 155,
      promptTokensDetails: [
        { modality: 'AUDIO', tokenCount: 70 },
        { modality: 'TEXT', tokenCount: 25 },
        { modality: 'IMAGE', tokenCount: 5 },
      ],
      responseTokensDetails: [{ modality: 'AUDIO', tokenCount: 40 }],
    });
    expect(n).toMatchObject({
      prompt: 100,
      response: 40,
      toolUse: 10,
      thoughts: 5,
      cached: 20,
      total: 155,
      inAudio: 70,
      inText: 25,
      inImage: 5,
      outAudio: 40,
    });
  });

  test('falls back to the sum when totalTokenCount is missing, ignores junk', () => {
    expect(normalizeUsage({ promptTokenCount: 3, responseTokenCount: 2 }).total).toBe(5);
    expect(normalizeUsage(null).total).toBe(0);
    expect(normalizeUsage({ promptTokenCount: -4, responseTokenCount: 'x' }).total).toBe(0);
  });
});

describe('VoiceUsageMeter', () => {
  test('per-response messages are summed (not just the last one)', () => {
    const m = new VoiceUsageMeter({ mode: 'per_response' });
    m.record(msg(100, 20), { turnId: 't1' });
    m.record(msg(150, 30), { turnId: 't2' });
    expect(m.totals()).toMatchObject({ inputTokens: 250, outputTokens: 50, totalTokens: 300 });
    expect(m.turnUsage('t1').totalTokens).toBe(120);
    expect(m.turnUsage('t2').totalTokens).toBe(180);
    expect(m.totals().details.responses).toBe(2);
  });

  test('cumulative mode counts only the growth between messages', () => {
    const m = new VoiceUsageMeter({ mode: 'cumulative' });
    m.record(msg(100, 20), { turnId: 't1' });
    m.record(msg(250, 50), { turnId: 't2' });
    expect(m.totals()).toMatchObject({ inputTokens: 250, outputTokens: 50, totalTokens: 300 });
    expect(m.turnUsage('t2').totalTokens).toBe(180);
  });

  test('auto: a running restatement inside one turn is not double-counted', () => {
    const m = new VoiceUsageMeter({ mode: 'auto' });
    m.record(msg(100, 10), { turnId: 't1' });
    m.record(msg(100, 25), { turnId: 't1' }); // same prompt, response grew → update
    expect(m.totals()).toMatchObject({ inputTokens: 100, outputTokens: 25, totalTokens: 125 });
    expect(m.totals().details.responses).toBe(1);
  });

  test('auto: a second response in the same turn (prompt grew) is added', () => {
    const m = new VoiceUsageMeter({ mode: 'auto' });
    m.record(msg(100, 10), { turnId: 't1' });
    m.record(msg(130, 15), { turnId: 't1' }); // after a tool result
    expect(m.totals().totalTokens).toBe(110 + 145);
    expect(m.totals().details.responses).toBe(2);
  });

  test('auto: an exact duplicate adds nothing', () => {
    const m = new VoiceUsageMeter();
    m.record(msg(100, 10), { turnId: 't1' });
    m.record(msg(100, 10), { turnId: 't1' });
    expect(m.totals().totalTokens).toBe(110);
  });

  test('sessionEndedUsage keeps the voice_session_ended shape', () => {
    const m = new VoiceUsageMeter();
    m.record(msg(10, 5));
    m.record(msg(20, 5));
    expect(m.sessionEndedUsage()).toEqual({ inputTokens: 30, outputTokens: 10, totalTokens: 40 });
  });

  test('caps the stored response list but keeps counting', () => {
    const m = new VoiceUsageMeter({ mode: 'per_response', maxResponses: 2 });
    for (let i = 0; i < 5; i += 1) m.record(msg(1, 1));
    expect(m.responses).toHaveLength(2);
    expect(m.totals().totalTokens).toBe(10);
  });
});
