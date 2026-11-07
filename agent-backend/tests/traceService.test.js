import { jest } from '@jest/globals';

const repo = {
  newId: jest.fn(() => 'aaaaaaaaaaaaaaaaaaaaaaaa'),
  isValidId: jest.fn(() => true),
  create: jest.fn(),
  update: jest.fn(),
  insertSpans: jest.fn(),
  search: jest.fn(),
  count: jest.fn(),
  findOne: jest.fn(),
  findLatest: jest.fn(),
  findSpans: jest.fn(),
  aggregateTraces: jest.fn(),
  aggregateSpans: jest.fn(),
};

jest.unstable_mockModule('../src/modules/traces/trace.repository.js', () => ({ default: repo }));
jest.unstable_mockModule('../src/utils/index.js', () => ({
  loggerService: {
    getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  },
}));

const traceService = (await import('../src/modules/traces/trace.service.js')).default;

const flush = () => new Promise((r) => setImmediate(r));

const projectAdmin = { domain: 'proj1', principalType: 'ProjectAdmin', personaUserId: 'u1' };
const projectRuntime = {
  domain: 'proj1',
  principalType: 'ProjectRuntime',
  credentialId: 'c1',
  externalUserId: 'ext-9',
};

describe('traceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.create.mockResolvedValue({});
  });

  test('never traces Persona (non-Project) runs', () => {
    expect(
      traceService.begin({
        executionContext: { domain: 'persona', principalType: 'PersonaUser' },
        agentId: 'a',
      })
    ).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });

  test('begin() creates a running trace with source/endUser derived from context', async () => {
    const t = traceService.begin({
      executionContext: projectRuntime,
      agentId: 'agent1',
      agentConfig: { name: 'Support Bot' },
      providerConfig: { modelName: 'gpt-x', label: 'OpenAI' },
      threadId: 'th1',
      channel: 'sms',
      input: 'hello',
    });
    expect(t.traceId).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
    await flush();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'proj1',
        agentId: 'agent1',
        agentName: 'Support Bot',
        source: 'api',
        channel: 'sms',
        endUserId: 'ext-9',
        status: 'running',
        model: 'gpt-x',
        provider: 'OpenAI',
        input: 'hello',
      })
    );
  });

  test('playground and architect sources', async () => {
    traceService.begin({ executionContext: projectAdmin, agentId: 'agent1' });
    await flush();
    expect(repo.create.mock.calls[0][0]).toMatchObject({ source: 'playground', endUserId: 'u1' });
    traceService.begin({ executionContext: projectAdmin, agentId: '000000000000000000000001' });
    await flush();
    expect(repo.create.mock.calls[1][0]).toMatchObject({
      source: 'architect',
      agentName: 'Architect',
    });
  });

  test('finish() persists spans and totals once', async () => {
    const t = traceService.begin({ executionContext: projectAdmin, agentId: 'agent1' });
    t.recorder.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    t.recorder.handleToolStart({ name: 'x' }, 'in', 't1', 'root', [], {}, 'x');
    t.recorder.handleToolEnd('out', 't1');
    t.recorder.handleChainEnd({}, 'root');

    await t.finish({ status: 'success' });
    await t.finish({ status: 'error' });

    expect(repo.insertSpans).toHaveBeenCalledTimes(1);
    const spans = repo.insertSpans.mock.calls[0][0];
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({
      traceId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      domain: 'proj1',
      agentId: 'agent1',
    });
    expect(spans[0].startedAt).toBeInstanceOf(Date);
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update.mock.calls[0][1]).toMatchObject({
      status: 'success',
      toolCalls: 1,
      spanCount: 2,
    });
  });

  test('finish() is fail-soft when the DB write fails', async () => {
    repo.insertSpans.mockRejectedValueOnce(new Error('db down'));
    const t = traceService.begin({ executionContext: projectAdmin, agentId: 'agent1' });
    await expect(t.finish({ status: 'success' })).resolves.toBeUndefined();
  });

  test('finish() skips writes when the trace was never created', async () => {
    repo.create.mockRejectedValueOnce(new Error('db down'));
    const t = traceService.begin({ executionContext: projectAdmin, agentId: 'agent1' });
    await t.finish({ status: 'success' });
    expect(repo.insertSpans).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  test('list() scopes by domain and applies filters', async () => {
    repo.search.mockResolvedValue([{ _id: 't' }]);
    repo.count.mockResolvedValue(1);
    const res = await traceService.list(
      'proj1',
      { agentId: 'a', status: 'error', source: 'api', from: '2026-01-01', bogus: 1 },
      { page: 2, limit: 10 }
    );
    const filter = repo.search.mock.calls[0][0];
    expect(filter).toMatchObject({ domain: 'proj1', agentId: 'a', status: 'error', source: 'api' });
    expect(filter.startedAt.$gte).toBeInstanceOf(Date);
    expect(filter.bogus).toBeUndefined();
    expect(repo.search.mock.calls[0][1]).toEqual({ page: 2, limit: 10 });
    expect(res).toEqual({ items: [{ _id: 't' }], total: 1 });
  });

  test('list() ignores unknown status values', async () => {
    repo.search.mockResolvedValue([]);
    repo.count.mockResolvedValue(0);
    await traceService.list('proj1', { status: 'nope' });
    expect(repo.search.mock.calls[0][0].status).toBeUndefined();
  });

  test('get() 404s for invalid ids and other Projects', async () => {
    repo.isValidId.mockReturnValueOnce(false);
    await expect(traceService.get('proj1', 'bad')).rejects.toMatchObject({ statusCode: 404 });
    repo.findOne.mockResolvedValueOnce(null);
    await expect(traceService.get('proj1', 'aaaaaaaaaaaaaaaaaaaaaaaa')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.findOne).toHaveBeenCalledWith({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', domain: 'proj1' });
  });

  test('get() returns the trace with its spans', async () => {
    repo.findOne.mockResolvedValueOnce({ _id: 'x' });
    repo.findSpans.mockResolvedValueOnce([{ spanId: 's' }]);
    await expect(traceService.get('proj1', 'aaaaaaaaaaaaaaaaaaaaaaaa')).resolves.toEqual({
      trace: { _id: 'x' },
      spans: [{ spanId: 's' }],
    });
  });

  test('stats() fills days, computes percentiles, and validates the window', async () => {
    const today = new Date().toISOString().slice(0, 10);
    repo.aggregateTraces.mockResolvedValueOnce([
      {
        totals: [{ _id: null, runs: 4, errors: 1, totalTokens: 100, avgDurationMs: 250 }],
        byDay: [{ _id: today, runs: 4, errors: 1, totalTokens: 100, avgDurationMs: 250 }],
        byAgent: [{ _id: 'a1', agentName: 'A', runs: 4, errors: 1 }],
        durations: [{ d: 100 }, { d: 200 }, { d: 300 }, { d: 400 }],
      },
    ]);
    repo.aggregateSpans.mockResolvedValueOnce([
      { _id: 'search', kind: 'tool', calls: 3, errors: 0 },
    ]);

    const s = await traceService.stats('proj1', { days: 7 });
    expect(s.byDay).toHaveLength(7);
    expect(s.byDay.at(-1)).toMatchObject({ date: today, runs: 4 });
    expect(s.byDay[0].runs).toBe(0);
    expect(s.totals).toMatchObject({ runs: 4, errors: 1, p50DurationMs: 200, p95DurationMs: 400 });
    expect(s.totals._id).toBeUndefined();
    expect(s.byAgent[0]).toMatchObject({ agentId: 'a1', agentName: 'A' });
    expect(s.tools[0]).toMatchObject({ name: 'search', calls: 3 });

    await expect(traceService.stats('proj1', { days: 365 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('an interrupted run records the pause as a trace field and a step', async () => {
    const t = traceService.begin({
      executionContext: projectAdmin,
      agentId: 'agent1',
      threadId: 'th1',
    });
    t.recorder.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    t.recorder.handleChainEnd({}, 'root');
    await t.finish({
      status: 'interrupted',
      interrupt: {
        kind: 'hitl',
        actionRequests: [{ name: 'write_file', args: { p: 1 } }],
        reviewConfigs: [],
      },
    });
    const update = repo.update.mock.calls.at(-1)[1];
    expect(update.status).toBe('interrupted');
    expect(update.interrupt).toMatchObject({ kind: 'hitl', summary: 'Approve write_file?' });
    const spans = repo.insertSpans.mock.calls[0][0];
    const pause = spans.find((s) => s.kind === 'interrupt');
    expect(pause).toMatchObject({ name: 'Approval required', parentSpanId: 'root' });
    expect(pause.input).toEqual([
      { name: 'write_file', args: { p: 1 }, description: '', allowedDecisions: null },
    ]);
  });

  test('a resumed run links to the paused trace and starts with the human decision', async () => {
    repo.findLatest.mockResolvedValueOnce({ _id: 'prevtrace' });
    repo.update.mockResolvedValue({});
    const pending = {
      kind: 'hitl',
      actionCount: 1,
      actionRequests: [{ name: 'write_file', args: {} }],
    };
    const t = traceService.begin({
      executionContext: projectAdmin,
      agentId: 'agent1',
      threadId: 'th1',
      input: '',
      resume: { pending, value: { decisions: [{ type: 'approve' }] } },
    });
    t.recorder.handleChainStart({}, {}, 'root', undefined, [], {}, undefined, 'agent');
    t.recorder.handleToolStart({ name: 'write_file' }, '{}', 't1', 'root', [], {}, 'write_file');
    t.recorder.handleToolEnd('ok', 't1');
    t.recorder.handleChainEnd({}, 'root');
    await t.finish({ status: 'success' });

    expect(repo.findLatest).toHaveBeenCalledWith({
      domain: 'proj1',
      threadId: 'th1',
      status: 'interrupted',
    });
    expect(repo.create.mock.calls[0][0]).toMatchObject({
      input: 'Approved write_file',
      resumedFromTraceId: 'prevtrace',
      resume: { kind: 'hitl', summary: 'Approved write_file' },
    });
    expect(repo.update).toHaveBeenCalledWith('prevtrace', {
      resumedByTraceId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    });
    const spans = repo.insertSpans.mock.calls[0][0];
    const human = spans.find((s) => s.kind === 'human');
    expect(human).toMatchObject({ name: 'Human decision', parentSpanId: 'root' });
    // Pinned before every real step.
    expect(spans[0].kind).toBe('human');
  });

  test('a resume with no thread skips the lookup', async () => {
    traceService.begin({
      executionContext: projectAdmin,
      agentId: 'agent1',
      resume: { pending: { kind: 'clarification' }, value: 'Paris' },
    });
    await Promise.resolve();
    expect(repo.findLatest).not.toHaveBeenCalled();
  });
});
