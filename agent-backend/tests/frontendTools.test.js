import {
  Annotation,
  Command,
  END,
  MemorySaver,
  Send,
  START,
  StateGraph,
} from '@langchain/langgraph';
import {
  FRONTEND_TOOL_LIMITS,
  createFrontendTool,
  formatFrontendToolResult,
  hashFrontendTools,
  normalizeFrontendTools,
} from '../src/modules/tools/frontendTool.tool.js';
import {
  buildResumeValue,
  describeInterrupt,
  isToolPause,
  translateLangGraphStream,
} from '../src/modules/agui/aguiTranslator.js';
import { createAgent } from 'langchain';
import { AIMessageChunk, HumanMessage } from '@langchain/core/messages';
import { ChatGenerationChunk } from '@langchain/core/outputs';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createToolErrorFeedbackMiddleware } from '../src/modules/agents/toolErrorFeedback.middleware.js';

function fakeStream(events, failWith) {
  return (async function* () {
    for (const e of events) yield e;
    if (failWith) throw failWith;
  })();
}

async function collect(gen) {
  const out = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

const ID_A = 'a'.repeat(32);
const ID_B = 'b'.repeat(32);

const frontendInterrupt = (id, toolCallId, name = 'open_page', args = {}) => ({
  id,
  value: { kind: 'frontend_tool', toolCallId, name, args },
});

describe('normalizeFrontendTools', () => {
  const tool = (over = {}) => ({
    name: 'open_page',
    description: 'Open a page in the app.',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
    ...over,
  });

  test('accepts valid tools and returns a detached, normalized copy', () => {
    const input = [tool()];
    const { tools, dropped } = normalizeFrontendTools(input);
    expect(dropped).toEqual([]);
    expect(tools).toEqual([
      {
        name: 'open_page',
        description: 'Open a page in the app.',
        parameters: { type: 'object', properties: { path: { type: 'string' } } },
      },
    ]);
    expect(tools[0].parameters).not.toBe(input[0].parameters);
  });

  test('missing parameters default to an empty object schema; missing description gets a default', () => {
    const { tools } = normalizeFrontendTools([{ name: 'ping' }]);
    expect(tools[0].parameters).toEqual({ type: 'object', properties: {} });
    expect(tools[0].description).toMatch(/ping/);
  });

  test('drops invalid names, duplicates, non-object schemas and oversized schemas', () => {
    const big = { type: 'object', description: 'x'.repeat(FRONTEND_TOOL_LIMITS.maxSchemaBytes) };
    const { tools, dropped } = normalizeFrontendTools([
      tool({ name: 'bad name!' }),
      tool(),
      tool(), // duplicate
      tool({ name: 'arr', parameters: { type: 'array' } }),
      tool({ name: 'str', parameters: 'nope' }),
      tool({ name: 'huge', parameters: big }),
    ]);
    expect(tools.map((t) => t.name)).toEqual(['open_page']);
    expect(dropped.map((d) => d.reason)).toEqual([
      'invalid name',
      'duplicate name',
      'parameters must be a JSON Schema object',
      'parameters must be a JSON Schema object',
      'parameters schema too large',
    ]);
  });

  test('never shadows deepagents built-ins or the given server tool names', () => {
    const { tools, dropped } = normalizeFrontendTools(
      [tool({ name: 'write_todos' }), tool({ name: 'search_web' }), tool()],
      { reservedNames: ['search_web'] }
    );
    expect(tools.map((t) => t.name)).toEqual(['open_page']);
    expect(dropped).toEqual([
      { name: 'write_todos', reason: 'name clashes with a server tool' },
      { name: 'search_web', reason: 'name clashes with a server tool' },
    ]);
  });

  test(`caps the tool count at ${FRONTEND_TOOL_LIMITS.maxTools}`, () => {
    const many = Array.from({ length: FRONTEND_TOOL_LIMITS.maxTools + 3 }, (_, i) =>
      tool({ name: `t${i}` })
    );
    const { tools, dropped } = normalizeFrontendTools(many);
    expect(tools).toHaveLength(FRONTEND_TOOL_LIMITS.maxTools);
    expect(dropped).toHaveLength(3);
  });

  test('non-array input yields nothing', () => {
    expect(normalizeFrontendTools(undefined)).toEqual({ tools: [], dropped: [] });
    expect(normalizeFrontendTools({ name: 'x' })).toEqual({ tools: [], dropped: [] });
  });
});

describe('hashFrontendTools / formatFrontendToolResult', () => {
  test('hash is stable for equal definitions and differs otherwise; empty for none', () => {
    const a = normalizeFrontendTools([{ name: 'a' }]).tools;
    const a2 = normalizeFrontendTools([{ name: 'a' }]).tools;
    const b = normalizeFrontendTools([{ name: 'b' }]).tools;
    expect(hashFrontendTools(a)).toBe(hashFrontendTools(a2));
    expect(hashFrontendTools(a)).not.toBe(hashFrontendTools(b));
    expect(hashFrontendTools([])).toBe('');
  });

  test('result shapes', () => {
    expect(formatFrontendToolResult({ result: 'opened' })).toBe('opened');
    expect(formatFrontendToolResult({ result: { ok: true } })).toBe('{"ok":true}');
    expect(formatFrontendToolResult({ result: null })).toBe('Done.');
    expect(formatFrontendToolResult({ error: 'denied' })).toBe(
      '{"status":"error","message":"denied"}'
    );
    expect(formatFrontendToolResult('raw')).toBe('raw');
  });
});

describe('describeInterrupt / buildResumeValue — frontend tools', () => {
  test('collects every frontend interrupt with its id', () => {
    const info = describeInterrupt([
      frontendInterrupt(ID_A, 'call_a', 'open_page', { path: '/a' }),
      frontendInterrupt(ID_B, 'call_b', 'confirm', {}),
    ]);
    expect(info).toEqual({
      kind: 'frontend_tool',
      actionCount: 2,
      calls: [
        { interruptId: ID_A, toolCallId: 'call_a', name: 'open_page', args: { path: '/a' } },
        { interruptId: ID_B, toolCallId: 'call_b', name: 'confirm', args: {} },
      ],
    });
  });

  test('frontend interrupts win over a clarification pending alongside', () => {
    const info = describeInterrupt([
      { id: ID_B, value: { kind: 'clarification', questions: [{ text: 'Which?' }] } },
      frontendInterrupt(ID_A, 'call_a'),
    ]);
    expect(info.kind).toBe('frontend_tool');
    expect(info.calls.map((c) => c.interruptId)).toEqual([ID_A]);
  });

  test('non-frontend interrupts are classified exactly as before', () => {
    expect(describeInterrupt([{ value: { questions: [{ text: 'Q?' }] } }]).kind).toBe(
      'clarification'
    );
    expect(
      describeInterrupt([{ value: { actionRequests: [{ name: 'x' }], reviewConfigs: [] } }]).kind
    ).toBe('hitl');
  });

  test('resume is a per-interrupt map; results, errors and unanswered calls', () => {
    const info = describeInterrupt([
      frontendInterrupt(ID_A, 'call_a'),
      frontendInterrupt(ID_B, 'call_b'),
    ]);
    expect(
      buildResumeValue(info, {
        toolResults: [
          { toolCallId: 'call_a', result: { ok: true } },
          { toolCallId: 'call_b', error: 'denied' },
        ],
      })
    ).toEqual({ [ID_A]: { result: { ok: true } }, [ID_B]: { error: 'denied' } });

    // Nothing answered + the user typed instead → every call still answered.
    expect(buildResumeValue(info, undefined, 'never mind')).toEqual({
      [ID_A]: { error: 'The user did not complete this action and instead said: never mind' },
      [ID_B]: { error: 'The user did not complete this action and instead said: never mind' },
    });
    expect(buildResumeValue(info, { toolResults: [] }, '')[ID_A]).toEqual({
      error: 'No result was returned by the client.',
    });
  });

  test('one call + one answer with a mismatched id is accepted (provider id drift)', () => {
    const info = describeInterrupt([frontendInterrupt(ID_A, 'call_server_id')]);
    expect(
      buildResumeValue(info, { toolResults: [{ toolCallId: 'call_streamed_id', result: 'ok' }] })
    ).toEqual({ [ID_A]: { result: 'ok' } });
  });

  test('without interrupt ids, a single call resumes with a plain value', () => {
    const info = describeInterrupt([
      { value: { kind: 'frontend_tool', toolCallId: 'c', name: 'x' } },
    ]);
    expect(buildResumeValue(info, { toolResults: [{ toolCallId: 'c', result: 1 }] })).toEqual({
      result: 1,
    });
  });
});

describe('frontend tools through a real LangGraph graph', () => {
  // Mirrors langchain's createAgent: each tool call runs as its own task via
  // Send, so parallel frontend calls pause with separate interrupt ids.
  function buildGraph() {
    const tool = createFrontendTool({
      name: 'open_page',
      description: 'Open a page.',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    });
    const State = Annotation.Root({
      calls: Annotation({ reducer: (_a, b) => b, default: () => [] }),
      results: Annotation({ reducer: (a, b) => a.concat(b), default: () => [] }),
    });
    return new StateGraph(State)
      .addNode('dispatch', () => ({}))
      .addNode('run', async (call) => {
        const msg = await tool.invoke({
          id: call.id,
          name: 'open_page',
          args: call.args,
          type: 'tool_call',
        });
        return { results: [{ id: call.id, content: msg.content }] };
      })
      .addEdge(START, 'dispatch')
      .addConditionalEdges('dispatch', (s) => s.calls.map((c) => new Send('run', c)))
      .addEdge('run', END)
      .compile({ checkpointer: new MemorySaver() });
  }

  test('parallel calls pause, then resume independently with the browser results', async () => {
    const graph = buildGraph();
    const config = { configurable: { thread_id: 't1' } };

    await graph.invoke(
      {
        calls: [
          { id: 'call_a', args: { path: '/a' } },
          { id: 'call_b', args: { path: '/b' } },
        ],
      },
      config
    );

    // Same check agui.service.js does before resuming.
    const state = await graph.getState(config);
    const interrupts = state.tasks.flatMap((t) => t.interrupts || []);
    const info = describeInterrupt(interrupts);
    expect(info.kind).toBe('frontend_tool');
    expect(info.calls.map((c) => [c.toolCallId, c.name, c.args]).sort()).toEqual([
      ['call_a', 'open_page', { path: '/a' }],
      ['call_b', 'open_page', { path: '/b' }],
    ]);
    expect(info.calls.every((c) => /^[0-9a-f]{32}$/.test(c.interruptId))).toBe(true);

    const resume = buildResumeValue(info, {
      toolResults: [
        { toolCallId: 'call_a', result: { opened: '/a' } },
        { toolCallId: 'call_b', error: 'Navigation blocked' },
      ],
    });
    const final = await graph.invoke(new Command({ resume }), config);

    const byId = Object.fromEntries(final.results.map((r) => [r.id, r.content]));
    expect(byId).toEqual({
      call_a: '{"opened":"/a"}',
      call_b: '{"status":"error","message":"Navigation blocked"}',
    });
    const after = await graph.getState(config);
    expect(after.tasks.flatMap((t) => t.interrupts || [])).toEqual([]);
  });
});

describe('translateLangGraphStream — frontend tool pause', () => {
  const pauseError = () => Object.assign(new Error('GraphInterrupt'), { name: 'GraphInterrupt' });

  test('on resume, replayed frontend stub runs are hidden; a new call of the same tool is not', async () => {
    const events = [
      // the paused call re-running on resume (no streamed args this run)
      {
        event: 'on_tool_start',
        run_id: 'replay',
        name: 'open_page',
        data: { input: { path: '/x' } },
      },
      { event: 'on_tool_end', run_id: 'replay', name: 'open_page', data: { output: 'opened' } },
      { event: 'on_chat_model_stream', data: { chunk: { content: 'Opened it.' } } },
      // the model then calls the same tool again — a genuinely new call
      {
        event: 'on_tool_start',
        run_id: 'fresh',
        name: 'open_page',
        data: { input: { path: '/y' } },
      },
      { event: 'on_tool_end', run_id: 'fresh', name: 'open_page', data: { output: 'opened y' } },
    ];
    const out = await collect(
      translateLangGraphStream(fakeStream(events), { replayedToolCalls: ['open_page'] })
    );
    const chunks = out.filter((e) => e.type === 'TOOL_CALL_CHUNK');
    const results = out.filter((e) => e.type === 'TOOL_CALL_RESULT');
    expect(chunks.map((e) => e.toolCallId)).toEqual(['fresh']);
    expect(results.map((e) => e.content)).toEqual(['opened y']);
  });

  test('isToolPause only matches real interrupts', () => {
    expect(isToolPause(pauseError())).toBe(true);
    expect(isToolPause({ interrupts: [{ value: {} }] })).toBe(true);
    expect(isToolPause(new Error('request was interrupted by peer'))).toBe(false);
    expect(isToolPause(undefined)).toBe(false);
  });

  test('isToolPause recognizes the STRING form streamEvents v2 actually delivers', () => {
    // on_tool_error's data.error is a string: the interrupt list JSON, then
    // the message again and the stack frames (captured from a real run).
    const list = JSON.stringify(
      [{ id: ID_A, value: { kind: 'frontend_tool', name: 'x' } }],
      null,
      2
    );
    const real = `${list}\n${list}\n    at interrupt (file:///node_modules/@langchain/langgraph/dist/interrupt.js:70:8)\n    at func (frontendTool.tool.js:150:24)`;
    expect(isToolPause(real)).toBe(true);
    expect(isToolPause(`GraphInterrupt: ${list}`)).toBe(true);
    // Look-alikes that are NOT pauses stay errors.
    expect(isToolPause('Error: connection interrupted\n    at fetch (x.js:1:1)')).toBe(false);
    expect(isToolPause('[1, 2, 3]')).toBe(false);
    expect(isToolPause('[]')).toBe(false);
    expect(isToolPause('Validation failed: [{"value": 1}]')).toBe(false);
  });

  test('emits frontend_tool_request, no error result for the paused call, no text notice', async () => {
    const events = [
      { event: 'on_tool_start', run_id: 'r1', name: 'open_page', data: { input: { path: '/x' } } },
      { event: 'on_tool_error', run_id: 'r1', name: 'open_page', data: { error: pauseError() } },
      {
        event: 'on_chain_stream',
        data: {
          chunk: {
            __interrupt__: [frontendInterrupt(ID_A, 'call_1', 'open_page', { path: '/x' })],
          },
        },
      },
    ];
    let paused;
    const out = await collect(
      translateLangGraphStream(fakeStream(events), { onInterrupt: (i) => (paused = i) })
    );

    expect(out.find((e) => e.type === 'TOOL_CALL_CHUNK')).toMatchObject({
      toolCallName: 'open_page',
    });
    expect(out.some((e) => e.type === 'TOOL_CALL_RESULT')).toBe(false);
    expect(out.some((e) => e.type === 'TEXT_MESSAGE_CHUNK')).toBe(false);
    expect(
      out.find((e) => e.type === 'CUSTOM' && e.name === 'frontend_tool_request').value
    ).toEqual({ calls: [{ toolCallId: 'call_1', name: 'open_page', args: { path: '/x' } }] });
    expect(paused.kind).toBe('frontend_tool');
  });

  test('same event when the pause arrives as a thrown GraphInterrupt', async () => {
    const err = Object.assign(pauseError(), {
      interrupts: [frontendInterrupt(ID_A, 'call_1', 'open_page', {})],
    });
    const out = await collect(translateLangGraphStream(fakeStream([], err)));
    expect(out.find((e) => e.name === 'frontend_tool_request').value.calls).toHaveLength(1);
    expect(out.some((e) => e.type === 'TEXT_MESSAGE_CHUNK')).toBe(false);
    expect(out.some((e) => e.type === 'RUN_ERROR')).toBe(false);
  });

  test('a real tool error that mentions "interrupt" is still reported as an error', async () => {
    const events = [
      { event: 'on_tool_start', run_id: 'r2', name: 'fetch_data', data: { input: {} } },
      {
        event: 'on_tool_error',
        run_id: 'r2',
        name: 'fetch_data',
        data: { error: new Error('connection interrupted') },
      },
    ];
    const out = await collect(translateLangGraphStream(fakeStream(events)));
    const result = out.find((e) => e.type === 'TOOL_CALL_RESULT');
    expect(result).toBeDefined();
    expect(JSON.parse(result.content).status).toBe('error');
  });
});

describe('frontend tools through a real langchain agent (createAgent)', () => {
  // Regression: the paused stub surfaced as a TOOL_CALL_RESULT error (its
  // on_tool_error payload is a string, which isToolPause didn't recognize),
  // so the browser's card flipped to "complete" — a confirm card showed
  // "Declined" before the user clicked anything.
  function scriptedModel(script) {
    let turn = 0;
    class ScriptedModel extends BaseChatModel {
      _llmType() {
        return 'scripted';
      }
      bindTools() {
        return this;
      }
      async _generate() {
        throw new Error('stream only');
      }
      async *_streamResponseChunks() {
        const step = script[turn++] ?? { text: '(done)' };
        const message = step.call
          ? new AIMessageChunk({
              content: '',
              tool_call_chunks: [
                {
                  id: step.call.id,
                  name: step.call.name,
                  args: JSON.stringify(step.call.args),
                  index: 0,
                  type: 'tool_call_chunk',
                },
              ],
            })
          : new AIMessageChunk({ content: step.text });
        yield new ChatGenerationChunk({ text: step.text ?? '', message });
      }
    }
    return new ScriptedModel({});
  }

  test('pause shows no result; "ask again" then Confirm reaches the model correctly', async () => {
    const agent = createAgent({
      model: scriptedModel([
        { call: { id: 'call_A', name: 'confirm_action', args: { title: 'Start?' } } },
        { call: { id: 'call_B', name: 'confirm_action', args: { title: 'Start? (again)' } } },
        { text: 'Starting.' },
      ]),
      tools: [
        createFrontendTool({
          name: 'confirm_action',
          description: 'Confirm.',
          parameters: { type: 'object', properties: { title: { type: 'string' } } },
        }),
      ],
      checkpointer: new MemorySaver(),
      middleware: [createToolErrorFeedbackMiddleware()],
    });
    const thread = { configurable: { thread_id: 'real-agent' } };
    const turn = (input, opts) =>
      collect(
        translateLangGraphStream(agent.streamEvents(input, { ...thread, version: 'v2' }), opts)
      );
    const pending = async () => {
      const s = await agent.getState(thread);
      return describeInterrupt((s.tasks || []).flatMap((t) => t.interrupts || []));
    };
    const requestOf = (out) =>
      out.find((e) => e.type === 'CUSTOM' && e.name === 'frontend_tool_request');

    // 1. The model calls the frontend tool: a card + a request, but NO result.
    const run1 = await turn({ messages: [new HumanMessage('start a mock test')] });
    expect(run1.some((e) => e.type === 'TOOL_CALL_RESULT')).toBe(false);
    expect(requestOf(run1).value.calls.map((c) => c.toolCallId)).toEqual(['call_A']);

    // 2. The user types instead of clicking: call_A is answered as not
    //    completed, the model asks again — again with no stray result.
    let p = await pending();
    const run2 = await turn(new Command({ resume: buildResumeValue(p, undefined, 'ask again') }), {
      replayedToolCalls: p.calls.map((c) => c.name),
    });
    expect(run2.some((e) => e.type === 'TOOL_CALL_RESULT')).toBe(false);
    expect(requestOf(run2).value.calls.map((c) => c.toolCallId)).toEqual(['call_B']);

    // 3. The user clicks Confirm.
    p = await pending();
    const run3 = await turn(
      new Command({
        resume: buildResumeValue(p, {
          toolResults: [{ toolCallId: 'call_B', result: { confirmed: true } }],
        }),
      }),
      { replayedToolCalls: p.calls.map((c) => c.name) }
    );
    expect(requestOf(run3)).toBeUndefined();
    expect(run3.some((e) => e.type === 'TOOL_CALL_CHUNK' || e.type === 'TOOL_CALL_RESULT')).toBe(
      false
    ); // the replayed stub stays hidden

    const state = await agent.getState(thread);
    expect((state.tasks || []).flatMap((t) => t.interrupts || [])).toEqual([]);
    const toolMessages = state.values.messages
      .filter((m) => m.getType() === 'tool')
      .map((m) => [m.tool_call_id, String(m.content)]);
    expect(toolMessages).toEqual([
      [
        'call_A',
        '{"status":"error","message":"The user did not complete this action and instead said: ask again"}',
      ],
      ['call_B', '{"confirmed":true}'],
    ]);
  });
});
