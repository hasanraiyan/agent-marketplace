import {
  foldSubagentEvent,
  settleTrace,
  extractTaskToolCallIds,
  reconcileSubagentTraceKeys,
} from '../src/modules/agui/subagentTrace.js';

describe('foldSubagentEvent', () => {
  test('merges contiguous text deltas and interleaves tool entries (client shape)', () => {
    const items = [];
    foldSubagentEvent(items, { kind: 'text', delta: 'plan ' });
    foldSubagentEvent(items, { kind: 'text', delta: 'first' });
    foldSubagentEvent(items, {
      kind: 'tool_start',
      toolName: 'write_file',
      args: '{"file_path":"/a.md"}',
    });
    foldSubagentEvent(items, { kind: 'tool_result', toolName: 'write_file', result: 'ok' });
    foldSubagentEvent(items, { kind: 'text', delta: 'done' });

    expect(items).toEqual([
      { type: 'text', text: 'plan first' },
      {
        type: 'tool',
        name: 'write_file',
        argsText: '{"file_path":"/a.md"}',
        resultText: 'ok',
        status: 'completed',
      },
      { type: 'text', text: 'done' },
    ]);
  });

  test('tool_result completes the most recent running call of that tool', () => {
    const items = [];
    foldSubagentEvent(items, { kind: 'tool_start', toolName: 'search_web', args: '{"q":1}' });
    foldSubagentEvent(items, { kind: 'tool_start', toolName: 'search_web', args: '{"q":2}' });
    foldSubagentEvent(items, { kind: 'tool_result', toolName: 'search_web', result: 'r2' });

    expect(items[0].status).toBe('running');
    expect(items[1]).toMatchObject({ status: 'completed', resultText: 'r2' });
  });

  test('ignores empty deltas and unknown kinds', () => {
    const items = [];
    foldSubagentEvent(items, { kind: 'text', delta: '' });
    foldSubagentEvent(items, { kind: 'bogus' });
    expect(items).toEqual([]);
  });
});

describe('settleTrace', () => {
  test('closes still-running tool entries', () => {
    const items = [
      { type: 'text', text: 'x' },
      { type: 'tool', name: 'a', argsText: '', resultText: '', status: 'running' },
    ];
    settleTrace(items);
    expect(items[1].status).toBe('completed');
  });
});

describe('extractTaskToolCallIds', () => {
  test('collects task tool_call ids, in order, from raw checkpoint messages', () => {
    const rawMessages = [
      { getType: () => 'human', content: 'hi' },
      {
        getType: () => 'ai',
        tool_calls: [
          { id: 'call_ls', name: 'ls' },
          { id: 'call_task_1', name: 'task' },
        ],
      },
      { getType: () => 'tool', tool_call_id: 'call_ls' },
      { getType: () => 'ai', tool_calls: [{ id: 'call_task_2', name: 'task' }] },
    ];

    expect(extractTaskToolCallIds(rawMessages)).toEqual(['call_task_1', 'call_task_2']);
  });

  test('ignores messages with no tool_calls and non-ai messages', () => {
    expect(extractTaskToolCallIds([{ getType: () => 'human', content: 'hi' }])).toEqual([]);
    expect(extractTaskToolCallIds([])).toEqual([]);
    expect(extractTaskToolCallIds(undefined)).toEqual([]);
  });
});

describe('reconcileSubagentTraceKeys', () => {
  test('re-keys provisional (run_id-shaped) keys to the checkpoint real tool_call ids, in order', () => {
    // Reproduces the exact mismatch reported live: the live stream folded a
    // task call's trace under a LangChain run_id because the provider never
    // streamed a stable tool_call id, but the checkpoint's real id for that
    // same call is "call_5310987".
    const subagentTraces = {
      '01a015d0-8baf-77cb-9d80-9b02469bee15': [{ type: 'text', text: 'done' }],
    };
    const realTaskToolCallIds = ['call_5310987'];

    expect(reconcileSubagentTraceKeys(subagentTraces, realTaskToolCallIds)).toEqual({
      call_5310987: [{ type: 'text', text: 'done' }],
    });
  });

  test('matches multiple task calls from this run positionally, in order', () => {
    const subagentTraces = {
      'run-a': [{ type: 'text', text: 'first' }],
      'run-b': [{ type: 'text', text: 'second' }],
    };
    // Includes an EARLIER turn's task call id too -- only the last N (N =
    // number of provisional keys) belong to this run.
    const realTaskToolCallIds = ['call_earlier_turn', 'call_1', 'call_2'];

    expect(reconcileSubagentTraceKeys(subagentTraces, realTaskToolCallIds)).toEqual({
      call_1: [{ type: 'text', text: 'first' }],
      call_2: [{ type: 'text', text: 'second' }],
    });
  });

  test('falls back to the provisional key when no real id is available, never dropping data', () => {
    const subagentTraces = { 'run-x': [{ type: 'text', text: 'orphan' }] };

    expect(reconcileSubagentTraceKeys(subagentTraces, [])).toEqual({
      'run-x': [{ type: 'text', text: 'orphan' }],
    });
  });

  test('returns the input unchanged when there is nothing to reconcile', () => {
    expect(reconcileSubagentTraceKeys({}, ['call_1'])).toEqual({});
  });
});
