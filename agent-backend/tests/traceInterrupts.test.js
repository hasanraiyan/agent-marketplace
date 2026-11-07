import { summarizeInterrupt, summarizeResume } from '../src/modules/traces/traceInterrupts.js';

const hitl = {
  kind: 'hitl',
  actionCount: 2,
  actionRequests: [
    { name: 'write_file', args: { path: '/a.md', apiKey: 'sk' }, description: 'Write a file' },
    { name: 'send_email', args: { to: 'x@y.z' } },
  ],
  reviewConfigs: [{ actionName: 'write_file', allowedDecisions: ['approve', 'reject'] }],
};

describe('traceInterrupts', () => {
  test('summarizes a HITL pause with masked args and allowed decisions', () => {
    const s = summarizeInterrupt(hitl);
    expect(s).toMatchObject({
      kind: 'hitl',
      title: 'Approval required',
      summary: 'Approve write_file, send_email?',
    });
    expect(s.actions[0]).toEqual({
      name: 'write_file',
      args: { path: '/a.md', apiKey: '***' },
      description: 'Write a file',
      allowedDecisions: ['approve', 'reject'],
    });
    expect(s.actions[1].allowedDecisions).toBeNull();
  });

  test('summarizes clarification and frontend-tool pauses', () => {
    expect(
      summarizeInterrupt({
        kind: 'clarification',
        questions: [{ id: 'q1', text: 'Which city?', options: ['Paris'] }],
      })
    ).toMatchObject({
      kind: 'clarification',
      summary: 'Which city?',
      questions: [{ id: 'q1', options: ['Paris'] }],
    });
    expect(
      summarizeInterrupt({
        kind: 'frontend_tool',
        calls: [{ interruptId: 'i1', toolCallId: 'c1', name: 'set_theme', args: { t: 'dark' } }],
      })
    ).toMatchObject({
      kind: 'frontend_tool',
      summary: 'Client runs set_theme',
      actions: [{ name: 'set_theme', toolCallId: 'c1' }],
    });
    expect(summarizeInterrupt(null)).toBeNull();
  });

  test('summarizes HITL decisions against the pending actions', () => {
    const r = summarizeResume(hitl, {
      decisions: [{ type: 'approve' }, { type: 'reject', message: 'not now' }],
    });
    expect(r.summary).toBe('Approved write_file · Rejected send_email: not now');
    expect(r.decisions[1]).toMatchObject({
      action: 'send_email',
      type: 'reject',
      message: 'not now',
    });
  });

  test('captures edited args', () => {
    const r = summarizeResume(hitl, {
      decisions: [{ type: 'edit', editedAction: { name: 'write_file', args: { path: '/b.md' } } }],
    });
    expect(r.summary).toBe('Edited write_file');
    expect(r.decisions[0].editedArgs).toEqual({ path: '/b.md' });
  });

  test('summarizes clarification answers (text and structured)', () => {
    expect(summarizeResume({ kind: 'clarification' }, 'Paris')).toMatchObject({
      summary: 'Paris',
      text: 'Paris',
    });
    const r = summarizeResume(
      { kind: 'clarification' },
      { answers: [{ id: 'q1', value: 'Paris' }], text: '' }
    );
    expect(r.summary).toMatch(/^Answered the agent/);
    expect(r.answers).toEqual([{ id: 'q1', value: 'Paris' }]);
  });

  test('summarizes frontend tool results by interrupt id', () => {
    const pending = {
      kind: 'frontend_tool',
      calls: [
        { interruptId: 'i1', toolCallId: 'c1', name: 'set_theme' },
        { interruptId: 'i2', toolCallId: 'c2', name: 'get_location' },
      ],
    };
    const r = summarizeResume(pending, { i1: { result: { ok: true } }, i2: { error: 'denied' } });
    expect(r.summary).toBe('set_theme returned · get_location failed');
    expect(r.results).toEqual([
      { name: 'set_theme', toolCallId: 'c1', result: { ok: true }, error: null },
      { name: 'get_location', toolCallId: 'c2', result: null, error: 'denied' },
    ]);
  });
});
