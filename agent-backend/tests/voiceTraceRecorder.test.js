import { VoiceTraceRecorder } from '../src/modules/traces/VoiceTraceRecorder.js';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, tick: (ms) => (t += ms) };
}

const byKind = (spans, kind) => spans.filter((s) => s.kind === kind);

describe('VoiceTraceRecorder', () => {
  test('builds turn → user / agent steps with transcripts and first-audio latency', () => {
    const c = clock();
    const r = new VoiceTraceRecorder({ now: c.now, model: 'gemini-live', provider: 'Gemini' });
    r.turnStart('run-1');
    r.userSpeechStart();
    c.tick(1500);
    r.userSpeechEnd();
    r.userSaid('what is the DBMS syllabus?');
    c.tick(400);
    r.agentAudio({ startMs: 1900, endMs: 2500 });
    c.tick(2000);
    r.agentSaid('DBMS covers ER models.');
    r.turnEnd();

    const spans = r.drainClosed({ final: true });
    const [turn] = byKind(spans, 'chain');
    const [user] = byKind(spans, 'human');
    const [agent] = byKind(spans, 'llm');
    expect(turn.name).toBe('Turn 1');
    expect(turn.input).toBe('what is the DBMS syllabus?');
    expect(turn.output).toBe('DBMS covers ER models.');
    expect(user.parentSpanId).toBe(turn.spanId);
    expect(user.output).toEqual({ role: 'user', content: 'what is the DBMS syllabus?' });
    expect(agent.parentSpanId).toBe(turn.spanId);
    expect(agent.output).toEqual({ role: 'assistant', content: 'DBMS covers ER models.' });
    expect(agent.timeToFirstTokenMs).toBe(400);
    expect(agent.model).toBe('gemini-live');
    expect(agent.metadata.audio).toEqual({ startMs: 1900, endMs: 2500 });

    const totals = r.totals();
    expect(totals.input).toBe('what is the DBMS syllabus?');
    expect(totals.output).toBe('DBMS covers ER models.');
    expect(totals.llmCalls).toBe(1);
    expect(totals.voice.turns).toBe(1);
    expect(totals.voice.latency.firstAudioP50Ms).toBe(400);
  });

  test('barge-in marks the agent line as cut off and counts the interruption', () => {
    const c = clock();
    const r = new VoiceTraceRecorder({ now: c.now });
    r.turnStart('run-1');
    r.agentAudio(null);
    c.tick(500);
    r.interrupted({ droppedAgentMs: 1200 });
    r.agentSaid('Usually around');
    r.turnEnd();
    const spans = r.drainClosed({ final: true });
    const [agent] = byKind(spans, 'llm');
    const [intr] = byKind(spans, 'interrupt');
    expect(agent.metadata.partial).toBe(true);
    expect(intr.name).toBe('User interrupted');
    expect(intr.metadata.droppedAgentMs).toBe(1200);
    expect(r.totals().voice.interruptions).toBe(1);
  });

  test('a cut-off step with no words is closed when the next audio starts', () => {
    const c = clock();
    const r = new VoiceTraceRecorder({ now: c.now });
    r.turnStart('run-1');
    r.agentAudio(null);
    r.interrupted();
    c.tick(300);
    r.agentAudio(null); // next generation
    r.agentSaid('Sure.');
    r.turnEnd();
    const agents = byKind(r.drainClosed({ final: true }), 'llm');
    expect(agents).toHaveLength(2);
    expect(agents[0].metadata.partial).toBe(true);
    expect(agents[1].metadata.partial).toBeUndefined();
  });

  test('a new utterance after a normal one is not marked as cut off', () => {
    const r = new VoiceTraceRecorder();
    r.turnStart('run-1');
    r.interrupted(); // no agent open → nothing to mark
    r.agentAudio(null);
    r.agentSaid('Hello');
    expect(byKind(r.drainClosed({ final: true }), 'llm')[0].metadata.partial).toBeUndefined();
  });

  test('tools: success, error, cancelled, browser and end_call', () => {
    const r = new VoiceTraceRecorder();
    r.turnStart('run-1');
    r.toolStart({ id: 'a', name: 'search', args: { q: 'x', apiKey: 'secret' } });
    r.toolEnd('a', { output: { hits: 2 } });
    r.toolStart({ id: 'b', name: 'book' });
    r.toolEnd('b', { error: 'Tool call timed out after 20000ms' });
    r.toolStart({ id: 'c', name: 'slow' });
    r.toolEnd('c', { cancelled: true });
    r.toolStart({ id: 'd', name: 'show_chart' }, { frontend: true });
    r.toolEnd('d', { output: { ok: true } });
    r.toolStart({ id: 'e', name: 'end_call' }, { synthetic: true });
    r.toolEnd('e', { output: 'ok' });
    r.toolStart({ id: 'f', name: 'never_finishes' });

    const spans = r.drainClosed({ final: true });
    const tools = Object.fromEntries(byKind(spans, 'tool').map((s) => [s.name, s]));
    expect(tools.search.status).toBe('success');
    expect(tools.search.input.apiKey).toBe('***');
    expect(tools.search.output).toEqual({ hits: 2 });
    expect(tools.book).toMatchObject({
      status: 'error',
      error: 'Tool call timed out after 20000ms',
    });
    expect(tools.slow.metadata.cancelled).toBe(true);
    expect(tools.show_chart.metadata.frontend).toBe(true);
    expect(tools.end_call.metadata.synthetic).toBe(true);
    expect(tools.never_finishes).toMatchObject({ status: 'error' });
    expect(tools.never_finishes.metadata.cancelled).toBe(true);
    const totals = r.totals();
    expect(totals.toolCalls).toBe(6);
    expect(totals.toolErrors).toBe(3);
  });

  test('nested LangChain steps of a tool hang under its span', async () => {
    const r = new VoiceTraceRecorder();
    r.turnStart('run-1');
    r.toolStart({ id: 'kb', name: 'search_knowledge', args: { q: 'x' } });
    const [rec] = r.toolCallbacks('kb');
    rec.handleToolStart({ name: 'search_knowledge' }, '{"q":"x"}', 'tool-run', undefined);
    rec.handleRetrieverStart({}, 'x', 'ret-run', 'tool-run', [], {}, 'kb_retriever');
    rec.handleRetrieverEnd([{ pageContent: 'doc', metadata: {} }], 'ret-run');
    rec.handleToolEnd('result', 'tool-run');
    r.toolEnd('kb', { output: 'result' });

    const spans = r.drainClosed({ final: true });
    const tool = spans.find((s) => s.name === 'search_knowledge' && s.metadata.voice);
    const retriever = spans.find((s) => s.kind === 'retriever');
    expect(retriever.parentSpanId).toBe(tool.spanId);
    // The tool's own LangChain run is not duplicated.
    expect(spans.filter((s) => s.name === 'search_knowledge')).toHaveLength(1);
  });

  test('usage lands on the turn and agent step, including a message just after turnComplete', () => {
    const c = clock();
    const r = new VoiceTraceRecorder({ now: c.now, usageMode: 'per_response' });
    r.turnStart('run-1');
    r.agentAudio(null);
    r.usage({ promptTokenCount: 100, responseTokenCount: 20, totalTokenCount: 120 });
    r.agentSaid('Hi');
    r.turnEnd();
    r.usage({ promptTokenCount: 10, responseTokenCount: 5, totalTokenCount: 15 }); // late
    c.tick(500);
    expect(r.drainClosed()).toHaveLength(0); // still in the grace window
    c.tick(2000);
    const spans = r.drainClosed();
    const [turn] = byKind(spans, 'chain');
    const [agent] = byKind(spans, 'llm');
    expect(turn.usage.totalTokens).toBe(135);
    expect(agent.usage.totalTokens).toBe(135);
    expect(r.totals().usage.totalTokens).toBe(135);
  });

  test('spans are handed out once; reconnects and images are counted', () => {
    const r = new VoiceTraceRecorder();
    r.turnStart('run-1');
    r.userSaid('', { via: 'image', attachments: [{ mimeType: 'image/png' }] });
    r.reconnected();
    r.turnEnd();
    const first = r.drainClosed({ final: true });
    expect(first.length).toBeGreaterThan(0);
    expect(r.drainClosed({ final: true })).toHaveLength(0);
    const totals = r.totals();
    expect(totals.voice.reconnects).toBe(1);
    expect(totals.voice.imagesSent).toBe(1);
    expect(first.find((s) => s.name === 'Reconnected to Gemini')).toBeDefined();
  });

  test('steps outside a turn open one automatically; span cap sets truncated', () => {
    const r = new VoiceTraceRecorder({ maxSpans: 3 });
    r.userSaid('hello', { via: 'text' });
    r.userSaid('again', { via: 'text' });
    r.userSaid('more', { via: 'text' });
    r.userSaid('even more', { via: 'text' });
    expect(r.totals().truncated).toBe(true);
    expect(r.drainClosed({ final: true }).length).toBeLessThanOrEqual(3);
  });
});
