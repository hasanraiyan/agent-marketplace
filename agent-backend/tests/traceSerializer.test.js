import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { serializeForTrace, contentToText } from '../src/modules/traces/traceSerializer.js';

describe('traceSerializer', () => {
  test('collapses LangChain messages', () => {
    const out = serializeForTrace([
      new HumanMessage('hello'),
      new AIMessage({ content: '', tool_calls: [{ id: '1', name: 'search', args: { q: 'a' } }] }),
    ]);
    expect(out[0]).toEqual({ role: 'user', content: 'hello' });
    expect(out[1]).toEqual({
      role: 'assistant',
      content: '',
      tool_calls: [{ id: '1', name: 'search', args: { q: 'a' } }],
    });
  });

  test('masks credential-looking keys at any depth', () => {
    const out = serializeForTrace({
      headers: { Authorization: 'Bearer abc', 'x-trace': 'ok' },
      config: { api_key: 'sk', password: 'p', client_secret: 's' },
      usage: { input_tokens: 4 },
    });
    expect(out.headers).toEqual({ Authorization: '***', 'x-trace': 'ok' });
    expect(out.config).toEqual({ api_key: '***', password: '***', client_secret: '***' });
    expect(out.usage).toEqual({ input_tokens: 4 });
  });

  test('replaces data URLs and truncates long strings', () => {
    const img = `data:image/png;base64,${'A'.repeat(5000)}`;
    expect(serializeForTrace({ img }).img).toMatch(/^\[image\/png data URL/);
    const long = serializeForTrace('x'.repeat(20000), 100);
    expect(long.length).toBeLessThan(200);
  });

  test('handles cycles but keeps repeated non-circular references', () => {
    const shared = { a: 1 };
    const obj = { one: shared, two: shared };
    obj.self = obj;
    const out = serializeForTrace(obj);
    expect(out.one).toEqual({ a: 1 });
    expect(out.two).toEqual({ a: 1 });
    expect(out.self).toBe('[circular]');
  });

  test('oversized results become a truncated preview string', () => {
    const big = Array.from({ length: 40 }, (_, i) => ({ i, text: 'y'.repeat(500) }));
    const out = serializeForTrace(big, 1000);
    expect(typeof out).toBe('string');
    expect(out).toMatch(/truncated/);
  });

  test('contentToText joins text blocks and labels non-text parts', () => {
    expect(contentToText('a')).toBe('a');
    expect(
      contentToText([
        { type: 'text', text: 'a' },
        { type: 'image_url' },
        { type: 'text', text: 'b' },
      ])
    ).toBe('ab');
    expect(contentToText([{ type: 'image', name: 'photo.png' }])).toBe('[image: photo.png]');
    expect(contentToText([{ type: 'image', mimeType: 'image/jpeg' }])).toBe('[image: image/jpeg]');
    expect(contentToText(null)).toBe('');
  });

  test('prunes raw base64 data and image objects', () => {
    const rawB64 = 'A'.repeat(2000);
    const out = serializeForTrace({
      msg: {
        type: 'image',
        mimeType: 'image/png',
        data: rawB64,
      },
      standaloneB64: rawB64,
    });
    expect(out.msg.data).toBe('[image/png base64, 2000 chars]');
    expect(out.standaloneB64).toBe('[base64 data, 2000 chars]');
  });
});
