import { foldSubagentEvent, settleTrace } from '../src/modules/agui/subagentTrace.js';

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
