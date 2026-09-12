import { describe, expect, it, vi } from 'vitest';
import { PersonaClient } from '../../src/client.js';
import { EventType } from '../../src/types/chat.js';
import type { Workflow, WorkflowDraft, WorkflowRun, WorkflowVersion } from '../../src/types/workflow.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function sseResponse(events: unknown[], status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function makeClient(fetchMock: typeof fetch, externalUserId?: string) {
  return new PersonaClient({
    baseUrl: 'https://api.example.com',
    credential: 'key.secret',
    externalUserId,
    fetch: fetchMock,
  });
}

const mockDraft: WorkflowDraft = {
  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      data: { label: 'Start Trigger' },
    },
    {
      id: 'agent_step',
      type: 'agentStep',
      data: { label: 'Analyst Agent', config: { agentId: 'ag-1' } },
    },
    {
      id: 'output',
      type: 'output',
      data: { label: 'Final Output' },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger', target: 'agent_step' },
    { id: 'e2', source: 'agent_step', target: 'output' },
  ],
  trigger: { type: 'manual', config: {} },
};

const mockWorkflow: Workflow = {
  _id: 'wf-123',
  domain: 'proj-1',
  name: 'Research Pipeline',
  description: 'Multi-agent analysis pipeline',
  isEnabled: true,
  visibility: 'private',
  ownerType: 'Project',
  draft: mockDraft,
  publishedVersion: 1,
  activeRuns: 0,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

const mockVersion: WorkflowVersion = {
  _id: 'ver-1',
  workflowId: 'wf-123',
  projectId: 'proj-1',
  version: 1,
  definition: mockDraft,
  publishedAt: '2026-09-12T00:00:00.000Z',
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

const mockRun: WorkflowRun = {
  _id: 'run-456',
  workflowId: 'wf-123',
  workflowVersion: 1,
  projectId: 'proj-1',
  triggeredBy: { type: 'manual', userId: 'user-1' },
  status: 'completed',
  isDryRun: false,
  nodeRuns: [
    {
      nodeId: 'agent_step',
      nodeType: 'agentStep',
      status: 'completed',
      retriesTaken: 0,
      durationMs: 1200,
      tokens: 350,
      startedAt: '2026-09-12T00:00:01.000Z',
      endedAt: '2026-09-12T00:00:02.200Z',
      output: { summary: 'Analysis complete' },
    },
  ],
  output: { summary: 'Analysis complete' },
  usage: {
    totalTokens: 350,
    agentTurns: 1,
    toolCalls: 0,
    creditsDeducted: 4,
  },
  threadId: 'th-wf-123',
  startedAt: '2026-09-12T00:00:00.000Z',
  endedAt: '2026-09-12T00:00:03.000Z',
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:03.000Z',
};

describe('WorkflowsResource', () => {
  it('create() POSTs to /api/v1/developer/workflows with body and idempotency key', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: mockWorkflow }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.create(
      { name: 'Research Pipeline', draft: mockDraft },
      'idem-wf-1'
    );

    expect(result).toEqual(mockWorkflow);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/workflows');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-wf-1');
  });

  it('list() sends GET to /api/v1/developer/workflows with pagination and search query', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: {
          items: [mockWorkflow],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.list({ page: 2, limit: 10, search: 'Research' });

    expect(result.items).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/developer/workflows?');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
    expect(url).toContain('search=Research');
  });

  it('get() sends GET to /api/v1/developer/workflows/:workflowId', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: mockWorkflow })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.get('wf-123');
    expect(result).toEqual(mockWorkflow);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf-123');
    expect(init.method).toBe('GET');
  });

  it('update() sends PATCH to /api/v1/developer/workflows/:workflowId', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { ...mockWorkflow, name: 'Updated Name' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.update('wf-123', { name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf-123');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Updated Name' });
  });

  it('delete() sends DELETE to /api/v1/developer/workflows/:workflowId', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, message: 'Workflow deleted' })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.delete('wf-123');
    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf-123');
    expect(init.method).toBe('DELETE');
  });

  it('saveDraft() sends PUT to /api/v1/developer/workflows/:workflowId/draft', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: mockWorkflow })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.saveDraft('wf-123', mockDraft);
    expect(result).toEqual(mockWorkflow);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf-123/draft');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ draft: mockDraft });
  });

  it('publish() sends POST to /api/v1/developer/workflows/:workflowId/publish', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: mockVersion }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.publish('wf-123');
    expect(result.version).toBe(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf-123/publish');
    expect(init.method).toBe('POST');
  });

  it('listVersions() and getVersion() fetch published snapshots', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/versions/1')) {
        return jsonResponse({ success: true, data: mockVersion });
      }
      return jsonResponse({
        success: true,
        data: {
          items: [mockVersion],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        },
      });
    });
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const listRes = await client.workflows.listVersions('wf-123');
    expect(listRes.items).toHaveLength(1);

    const singleRes = await client.workflows.getVersion('wf-123', 1);
    expect(singleRes.version).toBe(1);
  });

  it('getMermaid() sends GET to /api/v1/developer/workflows/:workflowId/mermaid', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { mermaid: 'flowchart TD\n  trigger --> agent_step' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.getMermaid('wf-123');
    expect(result.mermaid).toContain('flowchart TD');
  });

  it('listRuns() and getRun() inspect execution traces', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/runs/run-456')) {
        return jsonResponse({ success: true, data: mockRun });
      }
      return jsonResponse({
        success: true,
        data: {
          items: [mockRun],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        },
      });
    });
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const listRes = await client.workflows.listRuns('wf-123', { status: 'completed' });
    expect(listRes.items).toHaveLength(1);

    const singleRun = await client.workflows.getRun('run-456');
    expect(singleRun._id).toBe('run-456');
    expect(singleRun.status).toBe('completed');
  });

  it('cancel() sends POST to /api/v1/developer/workflows/runs/:runId/cancel', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { ...mockRun, status: 'cancelled' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.cancel('run-456');
    expect(result.status).toBe('cancelled');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/workflows/runs/run-456/cancel');
    expect(init.method).toBe('POST');
  });

  it('stream() requests text/event-stream and yields sequence-ordered frames with parentStepId', async () => {
    const events = [
      { type: EventType.RUN_STARTED, runId: 'run-456', threadId: 'th-1', isDryRun: false, seq: 1 },
      {
        type: EventType.CUSTOM,
        name: 'workflow_node_started',
        value: { nodeId: 'agent_step', nodeType: 'agentStep' },
        seq: 2,
      },
      {
        type: EventType.TEXT_MESSAGE_CHUNK,
        delta: 'Processing report...',
        parentStepId: 'agent_step',
        seq: 3,
      },
      {
        type: EventType.CUSTOM,
        name: 'workflow_node_completed',
        value: { nodeId: 'agent_step', output: { summary: 'Done' }, durationMs: 500 },
        seq: 4,
      },
      {
        type: EventType.RUN_FINISHED,
        runId: 'run-456',
        output: { summary: 'Done' },
        usage: { totalTokens: 100, agentTurns: 1, toolCalls: 0, creditsDeducted: 1 },
        seq: 5,
      },
    ];

    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const received: unknown[] = [];
    for await (const frame of client.workflows.stream('wf-123', {
      input: { topic: 'AI' },
      dryRun: false,
    })) {
      received.push(frame);
    }

    expect(received).toEqual(events);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/workflows/wf-123/runs');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept']).toBe('text/event-stream');
    expect(JSON.parse(init.body as string)).toEqual({
      input: { topic: 'AI' },
      dryRun: false,
      isDryRun: false,
      version: undefined,
      stream: true,
    });
  });

  it('resumeStream() connects with sinceSeq query parameter', async () => {
    const events = [
      {
        type: EventType.CUSTOM,
        name: 'workflow_node_completed',
        value: { nodeId: 'agent_step' },
        seq: 4,
      },
      { type: EventType.RUN_FINISHED, runId: 'run-456', seq: 5 },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const received: unknown[] = [];
    for await (const frame of client.workflows.resumeStream('run-456', 3)) {
      received.push(frame);
    }

    expect(received).toEqual(events);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/workflows/runs/run-456/resume?sinceSeq=3');
    expect(init.method).toBe('GET');
  });

  it('run() drains stream and returns assembled WorkflowRunResult', async () => {
    const events = [
      { type: EventType.RUN_STARTED, runId: 'run-456', threadId: 'th-1', isDryRun: false, seq: 1 },
      {
        type: EventType.CUSTOM,
        name: 'workflow_node_started',
        value: { nodeId: 'agent_step', nodeType: 'agentStep', input: { query: 'test' } },
        seq: 2,
      },
      {
        type: EventType.CUSTOM,
        name: 'workflow_node_completed',
        value: {
          nodeId: 'agent_step',
          output: { result: '42' },
          retriesTaken: 0,
          durationMs: 800,
          tokens: 200,
        },
        seq: 3,
      },
      {
        type: EventType.RUN_FINISHED,
        runId: 'run-456',
        output: { result: '42' },
        usage: { totalTokens: 200, agentTurns: 1, toolCalls: 0, creditsDeducted: 2 },
        seq: 4,
      },
    ];

    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.workflows.run('wf-123', { input: { query: 'test' } });

    expect(result.runId).toBe('run-456');
    expect(result.threadId).toBe('th-1');
    expect(result.status).toBe('completed');
    expect(result.isDryRun).toBe(false);
    expect(result.output).toEqual({ result: '42' });
    expect(result.usage?.totalTokens).toBe(200);
    expect(result.nodeRuns['agent_step'].status).toBe('completed');
    expect(result.nodeRuns['agent_step'].durationMs).toBe(800);
    expect(result.events).toHaveLength(4);
  });
});
