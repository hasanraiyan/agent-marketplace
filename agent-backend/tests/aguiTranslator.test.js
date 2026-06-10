import { jest } from '@jest/globals';
import { ToolMessage } from '@langchain/core/messages';
import {
  translateLangGraphStream,
  emitTextNotice,
  flattenErrors,
  extractGraphInterrupts,
  isInterruptError,
  buildInterruptNotice,
  formatRuntimeError,
  buildFilesTodosSnapshot,
  extractToolOutputContent,
} from '../src/utils/aguiTranslator.js';

// Helper: turn an array of LangGraph events into an async iterable, optionally
// throwing `failWith` after they are all yielded (to exercise the catch path).
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

describe('translateLangGraphStream', () => {
  test('streams text before and after a tool call (the disconnect regression)', async () => {
    const events = [
      { event: 'on_chat_model_stream', data: { chunk: { content: 'Thinking...' } } },
      {
        event: 'on_tool_start',
        run_id: 'tool_1',
        name: 'search_web',
        data: { input: { query: 'x' } },
      },
      { event: 'on_tool_end', run_id: 'tool_1', name: 'search_web', data: { output: 'results' } },
      { event: 'on_chat_model_stream', data: { chunk: { content: 'Done.' } } },
    ];

    const out = await collect(translateLangGraphStream(fakeStream(events)));

    const text = out
      .filter((e) => e.type === 'TEXT_MESSAGE_CHUNK')
      .map((e) => e.delta)
      .join('');
    expect(text).toBe('Thinking...Done.');

    // Text before vs after the tool are separate messages (different ids).
    const textIds = [
      ...new Set(out.filter((e) => e.type === 'TEXT_MESSAGE_CHUNK').map((e) => e.messageId)),
    ];
    expect(textIds).toHaveLength(2);

    const toolChunk = out.find((e) => e.type === 'TOOL_CALL_CHUNK');
    expect(toolChunk).toMatchObject({
      toolCallId: 'tool_1',
      toolCallName: 'search_web',
      delta: JSON.stringify({ query: 'x' }),
    });
    // The bug class: chunk events must never carry a null parentMessageId.
    expect('parentMessageId' in toolChunk).toBe(false);

    const result = out.find((e) => e.type === 'TOOL_CALL_RESULT');
    expect(result).toMatchObject({ toolCallId: 'tool_1', content: 'results', role: 'tool' });
  });

  test('tool call with no preceding text emits no null parentMessageId', async () => {
    const events = [
      { event: 'on_tool_start', run_id: 't', name: 'search_web', data: { input: {} } },
    ];
    const out = await collect(translateLangGraphStream(fakeStream(events)));
    const toolChunk = out.find((e) => e.type === 'TOOL_CALL_CHUNK');
    expect(toolChunk).toBeDefined();
    expect(toolChunk.parentMessageId).toBeUndefined();
  });

  test('skips internal nested-tool calls', async () => {
    const events = [
      {
        event: 'on_tool_start',
        run_id: 'nested',
        name: 'TavilySearch',
        tags: ['internal:nested-tool'],
        data: { input: { q: 1 } },
      },
      { event: 'on_tool_end', run_id: 'nested', name: 'TavilySearch', data: { output: 'leak' } },
    ];
    const out = await collect(translateLangGraphStream(fakeStream(events)));
    expect(out.find((e) => e.type === 'TOOL_CALL_CHUNK')).toBeUndefined();
    // its on_tool_end must not produce a RESULT either (never registered).
    expect(out.find((e) => e.type === 'TOOL_CALL_RESULT')).toBeUndefined();
  });

  test('serializes non-string tool output as JSON', async () => {
    const events = [
      { event: 'on_tool_start', run_id: 'a', name: 'calc', data: { input: { n: 2 } } },
      { event: 'on_tool_end', run_id: 'a', name: 'calc', data: { output: { answer: 42 } } },
    ];
    const out = await collect(translateLangGraphStream(fakeStream(events)));
    expect(out.find((e) => e.type === 'TOOL_CALL_RESULT').content).toBe(
      JSON.stringify({ answer: 42 })
    );
  });

  test('unwraps a ToolMessage output to its content (the search_web "No sources" bug)', async () => {
    // When a tool returns an object (e.g. Tavily `{ query, results }`), LangChain
    // wraps it in a ToolMessage, so event.data.output is the message instance.
    // The result content must be the real payload, NOT JSON.stringify(message)
    // which would serialize LangChain's {lc,type,id,kwargs} envelope.
    const tavily = { query: 'cats', results: [{ title: 'T', url: 'u', content: 'c' }] };
    const toolMessage = new ToolMessage({
      content: JSON.stringify(tavily),
      tool_call_id: 'sw1',
      name: 'search_web',
    });
    const events = [
      {
        event: 'on_tool_start',
        run_id: 'sw1',
        name: 'search_web',
        data: { input: { query: 'cats' } },
      },
      { event: 'on_tool_end', run_id: 'sw1', name: 'search_web', data: { output: toolMessage } },
    ];
    const out = await collect(translateLangGraphStream(fakeStream(events)));
    const result = out.find((e) => e.type === 'TOOL_CALL_RESULT');
    expect(result.content).toBe(JSON.stringify(tavily));
    // round-trips back to the real shape the renderer expects
    expect(JSON.parse(result.content).results).toHaveLength(1);
    expect(result.content).not.toContain('"lc"');
    expect(result.content).not.toContain('kwargs');
  });

  test('synthesizes assistant text when a stream finishes immediately after a tool result', async () => {
    const events = [
      {
        event: 'on_tool_start',
        run_id: 'upsert-1',
        name: 'upsert_agent',
        data: { input: { name: 'Bot' } },
      },
      {
        event: 'on_tool_end',
        run_id: 'upsert-1',
        name: 'upsert_agent',
        data: {
          output: JSON.stringify({
            status: 'success',
            message: 'Successfully created new agent: Bot',
          }),
        },
      },
    ];

    const out = await collect(translateLangGraphStream(fakeStream(events)));

    expect(out.find((e) => e.type === 'TOOL_CALL_RESULT')).toBeDefined();
    const text = out.find((e) => e.type === 'TEXT_MESSAGE_CHUNK');
    expect(text).toBeDefined();
    expect(text.delta).toBe('Successfully created new agent: Bot');
  });

  test('does not synthesize duplicate assistant text when the model speaks after a tool result', async () => {
    const events = [
      { event: 'on_tool_start', run_id: 'a', name: 'write_file', data: { input: {} } },
      { event: 'on_tool_end', run_id: 'a', name: 'write_file', data: { output: 'ok' } },
      { event: 'on_chat_model_stream', data: { chunk: { content: 'Done already.' } } },
    ];

    const out = await collect(translateLangGraphStream(fakeStream(events)));
    const text = out.filter((e) => e.type === 'TEXT_MESSAGE_CHUNK').map((e) => e.delta);
    expect(text).toEqual(['Done already.']);
  });

  test('on interrupt: calls onInterrupt and yields the question prompt, not an error', async () => {
    const interruptErr = Object.assign(new Error('Interrupt'), {
      name: 'GraphInterrupt',
      interrupts: [{ value: { questions: [{ text: 'Which env?', options: ['dev', 'prod'] }] } }],
    });
    const onInterrupt = jest.fn();
    const onError = jest.fn();

    const out = await collect(
      translateLangGraphStream(fakeStream([], interruptErr), { onInterrupt, onError })
    );

    expect(onInterrupt).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    const notice = out.find((e) => e.type === 'TEXT_MESSAGE_CHUNK').delta;
    expect(notice).toContain('Which env?');
    expect(notice).toContain('a) dev');
    expect(notice).toContain('b) prod');
  });

  test('detects interrupt payloads emitted as normal stream chunks', async () => {
    const hitlValue = {
      actionRequests: [{ name: 'write_file', args: { file_path: '/ai.md' } }],
      reviewConfigs: [{ actionName: 'write_file', allowedDecisions: ['approve', 'reject'] }],
    };
    const onInterrupt = jest.fn();

    const out = await collect(
      translateLangGraphStream(
        fakeStream([
          {
            event: 'on_chain_stream',
            data: { chunk: { __interrupt__: [{ value: hitlValue }] } },
          },
        ]),
        { onInterrupt }
      )
    );

    expect(onInterrupt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'hitl', actionCount: 1 })
    );
    const custom = out.find((e) => e.type === 'CUSTOM');
    expect(custom).toBeDefined();
    expect(custom.name).toBe('hitl_request');
    expect(custom.value.actionRequests[0].name).toBe('write_file');
    const notice = out.find((e) => e.type === 'TEXT_MESSAGE_CHUNK');
    expect(notice.delta).toContain('write_file');
  });

  test('on genuine failure: flattens AggregateError, logs leaves, surfaces real cause', async () => {
    const real = new Error('Incorrect API key provided');
    const aggregate = Object.assign(new Error('Multiple errors occurred during superstep 6'), {
      name: 'AggregateError',
      errors: [real],
    });
    const onInterrupt = jest.fn();
    const onError = jest.fn();

    const out = await collect(
      translateLangGraphStream(fakeStream([], aggregate), {
        providerConfig: { label: 'OpenAI' },
        onInterrupt,
        onError,
      })
    );

    expect(onInterrupt).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    const [leaves] = onError.mock.calls[0];
    expect(leaves).toHaveLength(1);
    expect(leaves[0]).toBe(real);

    const notice = out.find((e) => e.type === 'TEXT_MESSAGE_CHUNK').delta;
    // provider-auth message, not the opaque superstep wrapper
    expect(notice).toContain('OpenAI');
    expect(notice).toContain('invalid credentials');
    expect(notice).not.toContain('superstep');
  });
});

describe('extractToolOutputContent', () => {
  test('passes strings through unchanged', () => {
    expect(extractToolOutputContent("Successfully wrote to '/a.md'")).toBe(
      "Successfully wrote to '/a.md'"
    );
  });

  test('unwraps a ToolMessage to its string content', () => {
    const tm = new ToolMessage({ content: '{"results":[]}', tool_call_id: 'x', name: 't' });
    expect(extractToolOutputContent(tm)).toBe('{"results":[]}');
  });

  test('joins array content blocks into text', () => {
    const tm = new ToolMessage({
      content: [
        { type: 'text', text: 'hello ' },
        { type: 'text', text: 'world' },
      ],
      tool_call_id: 'x',
      name: 't',
    });
    expect(extractToolOutputContent(tm)).toBe('hello world');
  });

  test('serializes a plain object that is not a message', () => {
    expect(extractToolOutputContent({ answer: 42 })).toBe(JSON.stringify({ answer: 42 }));
  });

  test('handles null/undefined', () => {
    expect(extractToolOutputContent(null)).toBe('');
    expect(extractToolOutputContent(undefined)).toBe('');
  });
});

describe('state snapshots (files + todos)', () => {
  const stateValues = {
    files: {
      '/report.md': {
        content: ['# Title', 'body line'],
        created_at: 'c',
        modified_at: 'm',
      },
      '/skills/foo/SKILL.md': { content: ['seeded'] },
    },
    todos: [
      { content: 'step one', status: 'completed' },
      { content: 'step two', status: 'in_progress' },
    ],
  };

  test('buildFilesTodosSnapshot joins line arrays, excludes /skills/, normalizes todos', () => {
    const snap = buildFilesTodosSnapshot(stateValues);
    expect(Object.keys(snap.files)).toEqual(['/report.md']); // /skills/ filtered out
    expect(snap.files['/report.md'].content).toBe('# Title\nbody line');
    expect(snap.files['/report.md'].size).toBe('# Title\nbody line'.length);
    expect(snap.files['/report.md'].modified_at).toBe('m');
    expect(snap.todos).toEqual([
      { content: 'step one', status: 'completed' },
      { content: 'step two', status: 'in_progress' },
    ]);
  });

  test('buildFilesTodosSnapshot tolerates missing/empty state', () => {
    expect(buildFilesTodosSnapshot(undefined)).toEqual({ files: {}, todos: [] });
    expect(buildFilesTodosSnapshot({})).toEqual({ files: {}, todos: [] });
  });

  test('emits a STATE_SNAPSHOT at end of a successful stream when getState is provided', async () => {
    const getState = jest.fn().mockResolvedValue(stateValues);
    const events = [{ event: 'on_chat_model_stream', data: { chunk: { content: 'hi' } } }];
    const out = await collect(translateLangGraphStream(fakeStream(events), { getState }));

    const snapEvent = out.find((e) => e.type === 'STATE_SNAPSHOT');
    expect(snapEvent).toBeDefined();
    expect(snapEvent.snapshot.files['/report.md'].content).toBe('# Title\nbody line');
    expect(snapEvent.snapshot.todos).toHaveLength(2);
    // The snapshot lands after the assistant text, once the turn settles.
    expect(out[out.length - 1].type).toBe('STATE_SNAPSHOT');
  });

  test('does not emit STATE_SNAPSHOT when state has no files or todos', async () => {
    const getState = jest.fn().mockResolvedValue({ files: {}, todos: [] });
    const out = await collect(translateLangGraphStream(fakeStream([]), { getState }));
    expect(out.find((e) => e.type === 'STATE_SNAPSHOT')).toBeUndefined();
  });

  test('a getState failure never aborts the stream', async () => {
    const getState = jest.fn().mockRejectedValue(new Error('checkpointer down'));
    const events = [{ event: 'on_chat_model_stream', data: { chunk: { content: 'hi' } } }];
    const out = await collect(translateLangGraphStream(fakeStream(events), { getState }));
    expect(out.find((e) => e.type === 'TEXT_MESSAGE_CHUNK').delta).toBe('hi');
    expect(out.find((e) => e.type === 'STATE_SNAPSHOT')).toBeUndefined();
  });

  test('emits a STATE_SNAPSHOT on interrupt (files written before the pause)', async () => {
    const getState = jest.fn().mockResolvedValue(stateValues);
    const interruptErr = Object.assign(new Error('Interrupt'), { name: 'GraphInterrupt' });
    const out = await collect(
      translateLangGraphStream(fakeStream([], interruptErr), { getState, onInterrupt: jest.fn() })
    );
    expect(out.find((e) => e.type === 'STATE_SNAPSHOT')).toBeDefined();
  });

  test('does NOT emit STATE_SNAPSHOT on a genuine error (state may be inconsistent)', async () => {
    const getState = jest.fn().mockResolvedValue(stateValues);
    const out = await collect(
      translateLangGraphStream(fakeStream([], new Error('boom')), { getState, onError: jest.fn() })
    );
    expect(out.find((e) => e.type === 'STATE_SNAPSHOT')).toBeUndefined();
  });
});

describe('error helpers', () => {
  test('flattenErrors unwraps nested AggregateError + cause to leaves', () => {
    const leaf1 = new Error('a');
    const leaf2 = new Error('b');
    const mid = Object.assign(new Error('mid'), { errors: [leaf2] });
    const top = Object.assign(new Error('top'), { errors: [leaf1], cause: mid });
    const leaves = flattenErrors(top);
    expect(leaves).toEqual(expect.arrayContaining([leaf1, leaf2]));
    expect(leaves).not.toContain(top);
  });

  test('flattenErrors is cycle-safe', () => {
    const a = new Error('a');
    a.cause = a;
    expect(() => flattenErrors(a)).not.toThrow();
  });

  test('extractGraphInterrupts finds interrupts nested in errors[]', () => {
    const inner = { interrupts: [{ value: 1 }] };
    const agg = { errors: [{}, inner] };
    expect(extractGraphInterrupts(agg)).toBe(inner.interrupts);
  });

  test('isInterruptError detects GraphInterrupt by name and message', () => {
    expect(isInterruptError({ name: 'GraphInterrupt' })).toBe(true);
    expect(isInterruptError(new Error('an interrupt happened'))).toBe(true);
    expect(isInterruptError(new Error('boom'))).toBe(false);
  });

  test('buildInterruptNotice falls back when no structured questions', () => {
    expect(buildInterruptNotice(null, new Error('x'))).toMatch(/need your input/i);
  });

  test('formatRuntimeError maps provider auth errors to a friendly message', () => {
    expect(
      formatRuntimeError(new Error('Incorrect API key provided'), { label: 'Acme' })
    ).toContain('Acme');
    expect(formatRuntimeError(new Error('some other failure'))).toBe('some other failure');
  });
});

describe('emitTextNotice', () => {
  test('yields a single assistant text chunk', async () => {
    const out = await collect(emitTextNotice('hello'));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'TEXT_MESSAGE_CHUNK', role: 'assistant', delta: 'hello' });
    expect(typeof out[0].messageId).toBe('string');
  });
});

describe('logging', () => {
  test('logs tool calls and an end-of-stream summary when a logger is provided', async () => {
    const logger = { debug: jest.fn(), info: jest.fn() };
    const events = [
      { event: 'on_chat_model_stream', data: { chunk: { content: 'hi' } } },
      { event: 'on_tool_start', run_id: 'a', name: 'search_web', data: { input: { query: 'q' } } },
      { event: 'on_tool_end', run_id: 'a', name: 'search_web', data: { output: 'r' } },
    ];
    await collect(translateLangGraphStream(fakeStream(events), { logger }));

    expect(logger.debug).toHaveBeenCalledWith(
      '[AG-UI] tool call',
      expect.objectContaining({ name: 'search_web' })
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[AG-UI] stream finished',
      expect.objectContaining({ textChunks: 1, toolCalls: 1, toolResults: 1 })
    );
  });
});
