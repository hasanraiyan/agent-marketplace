import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { TraceRecorder, extractUsage } from '../src/modules/traces/TraceRecorder.js';

function clock(start = 1000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => {
    t += ms;
  };
  return now;
}

/** Simulates one agent turn: root graph → model node (LLM) → tools node (tool). */
function simulateRun(rec, now) {
  rec.handleChainStart(
    { id: ['LangGraph'] },
    { messages: [] },
    'root',
    undefined,
    [],
    {},
    undefined,
    'agent'
  );
  // LangGraph internal plumbing — must be hidden.
  rec.handleChainStart(
    {},
    {},
    'hidden1',
    'root',
    ['langsmith:hidden'],
    {},
    undefined,
    'ChannelWrite'
  );
  rec.handleChainEnd({}, 'hidden1');

  rec.handleChainStart(
    {},
    {},
    'node1',
    'root',
    [],
    { langgraph_node: 'model_request', langgraph_step: 1 },
    undefined,
    'model_request'
  );
  // Wrapper inside the node: skipped, but its LLM child must attach to node1.
  rec.handleChainStart(
    {},
    {},
    'seq1',
    'node1',
    [],
    { langgraph_node: 'model_request' },
    undefined,
    'RunnableSequence'
  );
  rec.handleChatModelStart(
    { id: ['ChatOpenAI'] },
    [[new HumanMessage('hi'), new AIMessage('x')]],
    'llm1',
    'seq1',
    { invocation_params: { model: 'gpt-x', tools: [{ function: { name: 'search' } }] } },
    [],
    { ls_provider: 'openai' }
  );
  now.advance(50);
  rec.handleLLMNewToken('h', {}, 'llm1');
  now.advance(150);
  rec.handleLLMEnd(
    {
      generations: [
        [
          {
            text: '',
            message: new AIMessage({
              content: '',
              tool_calls: [{ id: 'c1', name: 'search', args: { q: 'x' } }],
              usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
            }),
          },
        ],
      ],
    },
    'llm1'
  );
  rec.handleChainEnd({}, 'seq1');
  rec.handleChainEnd({}, 'node1');

  rec.handleChainStart(
    {},
    {},
    'node2',
    'root',
    [],
    { langgraph_node: 'tools' },
    undefined,
    'tools'
  );
  rec.handleToolStart(
    { name: 'search' },
    '{"q":"x","apiKey":"sk-123"}',
    'tool1',
    'node2',
    [],
    {},
    'search',
    'c1'
  );
  now.advance(30);
  rec.handleToolEnd(new ToolMessage({ content: 'result', tool_call_id: 'c1' }), 'tool1');
  rec.handleChainEnd({}, 'node2');

  // An empty middleware node — should be pruned.
  rec.handleChainStart(
    {},
    {},
    'node3',
    'root',
    [],
    { langgraph_node: 'after_model' },
    undefined,
    'after_model'
  );
  rec.handleChainEnd({}, 'node3');

  rec.handleChainEnd({ messages: [new HumanMessage('hi'), new AIMessage('final answer')] }, 'root');
}

describe('TraceRecorder', () => {
  test('builds a connected tree, hiding plumbing and re-parenting through skipped runs', () => {
    const now = clock();
    const rec = new TraceRecorder({ now });
    simulateRun(rec, now);
    const result = rec.finalize();

    const byId = Object.fromEntries(result.spans.map((s) => [s.spanId, s]));
    expect(Object.keys(byId).sort()).toEqual(['llm1', 'node1', 'node2', 'root', 'tool1']);
    expect(byId.llm1.parentSpanId).toBe('node1'); // skipped RunnableSequence bypassed
    expect(byId.tool1.parentSpanId).toBe('node2');
    expect(byId.root.parentSpanId).toBeNull();
  });

  test('captures LLM model, provider, usage, TTFT, tools offered and duration', () => {
    const now = clock();
    const rec = new TraceRecorder({ now });
    simulateRun(rec, now);
    const { spans, usage, llmCalls, toolCalls, model } = rec.finalize();
    const llm = spans.find((s) => s.spanId === 'llm1');

    expect(llm.kind).toBe('llm');
    expect(llm.model).toBe('gpt-x');
    expect(llm.provider).toBe('openai');
    expect(llm.timeToFirstTokenMs).toBe(50);
    expect(llm.durationMs).toBe(200);
    expect(llm.metadata.tools).toEqual(['search']);
    expect(llm.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(llm.output.tool_calls[0]).toMatchObject({ name: 'search', args: { q: 'x' } });
    expect(llm.input[0]).toEqual({ role: 'user', content: 'hi' });

    expect(usage.totalTokens).toBe(15);
    expect(llmCalls).toBe(1);
    expect(toolCalls).toBe(1);
    expect(model).toBe('gpt-x');
  });

  test('tool spans parse JSON input, mask secrets, and unwrap ToolMessage output', () => {
    const now = clock();
    const rec = new TraceRecorder({ now });
    simulateRun(rec, now);
    const tool = rec.finalize().spans.find((s) => s.spanId === 'tool1');
    expect(tool.input).toEqual({ q: 'x', apiKey: '***' });
    expect(tool.output).toBe('result');
    expect(tool.metadata.toolCallId).toBe('c1');
    expect(tool.durationMs).toBe(30);
  });

  test('final output is the last assistant message of the root state', () => {
    const now = clock();
    const rec = new TraceRecorder({ now });
    simulateRun(rec, now);
    expect(rec.finalize().output).toBe('final answer');
  });

  test('task tool becomes a subagent span named after subagent_type', () => {
    const rec = new TraceRecorder();
    rec.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    rec.handleToolStart(
      { name: 'task' },
      JSON.stringify({ subagent_type: 'researcher', description: 'd' }),
      't1',
      'root',
      [],
      {},
      'task'
    );
    rec.handleToolEnd(
      { update: { messages: [new ToolMessage({ content: 'done', tool_call_id: 'x' })] } },
      't1'
    );
    const span = rec.finalize().spans.find((s) => s.spanId === 't1');
    expect(span.kind).toBe('subagent');
    expect(span.name).toBe('researcher');
    expect(span.metadata).toMatchObject({
      tool: 'task',
      subagentType: 'researcher',
      description: 'd',
    });
    expect(span.output).toBe('done');
  });

  test('errors mark the span; GraphInterrupt does not', () => {
    const rec = new TraceRecorder();
    rec.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    rec.handleToolStart({ name: 'boom' }, 'x', 't1', 'root', [], {}, 'boom');
    rec.handleToolError(new Error('kaput'), 't1');
    rec.handleChainStart({}, {}, 'n1', 'root', [], { langgraph_node: 'tools' }, undefined, 'tools');
    const interrupt = new Error('interrupt');
    interrupt.name = 'GraphInterrupt';
    rec.handleChainError(interrupt, 'n1');
    const { spans, toolErrors } = rec.finalize();
    const tool = spans.find((s) => s.spanId === 't1');
    expect(tool.status).toBe('error');
    expect(tool.error).toBe('kaput');
    expect(toolErrors).toBe(1);
    const node = spans.find((s) => s.spanId === 'n1');
    expect(node.status).toBe('success');
    expect(node.metadata.interrupted).toBe(true);
  });

  test('ToolMessage with status error counts as a tool error', () => {
    const rec = new TraceRecorder();
    rec.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    rec.handleToolStart({ name: 't' }, 'x', 't1', 'root', [], {}, 't');
    rec.handleToolEnd(
      new ToolMessage({ content: 'bad', tool_call_id: 'x', status: 'error' }),
      't1'
    );
    expect(rec.finalize().toolErrors).toBe(1);
  });

  test('cancelled runs close open spans as errors', () => {
    const rec = new TraceRecorder();
    rec.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    rec.handleToolStart({ name: 'slow' }, 'x', 't1', 'root', [], {}, 'slow');
    const tool = rec.finalize({ cancelled: true }).spans.find((s) => s.spanId === 't1');
    expect(tool.status).toBe('error');
    expect(tool.endedAt).not.toBeNull();
  });

  test('duplicate start callbacks for the same run id are ignored', () => {
    const rec = new TraceRecorder();
    rec.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    rec.handleToolStart({ name: 't' }, 'x', 't1', 'root', [], {}, 't');
    rec.handleToolStart({ name: 't' }, 'x', 't1', 'root', [], {}, 't');
    rec.handleToolEnd('ok', 't1');
    expect(rec.finalize().spans.filter((s) => s.spanId === 't1')).toHaveLength(1);
  });

  test('span cap sets truncated and keeps children attached', () => {
    const rec = new TraceRecorder({ maxSpans: 2 });
    rec.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    rec.handleToolStart({ name: 'a' }, 'x', 't1', 'root', [], {}, 'a');
    rec.handleToolStart({ name: 'b' }, 'x', 't2', 'root', [], {}, 'b');
    const result = rec.finalize();
    expect(result.spans).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  test('extractUsage falls back to llmOutput.tokenUsage', () => {
    expect(
      extractUsage({
        generations: [[{ text: 'x' }]],
        llmOutput: { tokenUsage: { promptTokens: 3, completionTokens: 4 } },
      })
    ).toEqual({ inputTokens: 3, outputTokens: 4, totalTokens: 7 });
    expect(extractUsage({})).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  test('graph-node spans keep the messages they read and wrote', () => {
    const now = clock();
    const rec = new TraceRecorder({ now });
    simulateRun(rec, now);
    rec.handleChainStart(
      {},
      { messages: [new HumanMessage('q')] },
      'node4',
      'root',
      [],
      { langgraph_node: 'tools' },
      undefined,
      'tools'
    );
    rec.handleToolStart({ name: 't' }, 'x', 't9', 'node4', [], {}, 't');
    rec.handleToolEnd('ok', 't9');
    rec.handleChainEnd(
      [{ update: { messages: [new ToolMessage({ content: 'ok', tool_call_id: 'z' })] } }],
      'node4'
    );
    const node = rec.finalize().spans.find((s) => s.spanId === 'node4');
    expect(node.input).toEqual([{ role: 'user', content: 'q' }]);
    expect(node.output).toEqual([{ role: 'tool', content: 'ok', tool_call_id: 'z' }]);
  });

  test('subagent spans roll up the cost of everything inside them', () => {
    const rec = new TraceRecorder();
    rec.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    rec.handleToolStart(
      { name: 'task' },
      JSON.stringify({ subagent_type: 'gp', description: 'Paris' }),
      'sub1',
      'root',
      [],
      {},
      'task'
    );
    rec.handleChainStart(
      {},
      {},
      'sn',
      'sub1',
      [],
      { langgraph_node: 'model_request' },
      undefined,
      'model_request'
    );
    rec.handleChatModelStart({}, [[]], 'sl', 'sn', {}, [], {});
    rec.handleLLMEnd(
      {
        generations: [
          [
            {
              text: '',
              message: new AIMessage({
                content: 'x',
                usage_metadata: { input_tokens: 7, output_tokens: 3, total_tokens: 10 },
              }),
            },
          ],
        ],
      },
      'sl'
    );
    rec.handleChainEnd({}, 'sn');
    rec.handleToolStart({ name: 'get_weather' }, '{}', 'st', 'sub1', [], {}, 'get_weather');
    rec.handleToolError(new Error('down'), 'st');
    rec.handleToolEnd('Paris: sunny', 'sub1');
    rec.handleChainEnd({}, 'root');
    const result = rec.finalize();
    const sub = result.spans.find((s) => s.spanId === 'sub1');
    expect(sub.metadata.rollup).toEqual({
      llmCalls: 1,
      toolCalls: 1,
      errors: 1,
      inputTokens: 7,
      outputTokens: 3,
      totalTokens: 10,
    });
    expect(result.subagentCalls).toBe(1);
  });
});
