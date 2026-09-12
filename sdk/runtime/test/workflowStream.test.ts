import { describe, expect, it, vi } from 'vitest';
import { EventType } from '@personaai/sdk';
import { sseResponse, makeRuntime } from './helpers.js';

async function drain(body: AsyncIterable<string>): Promise<string[]> {
  const frames: string[] = [];
  for await (const chunk of body) frames.push(chunk);
  return frames;
}

describe('POST /workflows/:id/stream and resume', () => {
  it('streams workflow events and sets x-persona-run-id header', async () => {
    const events = [
      {
        type: EventType.CUSTOM,
        name: 'workflow_node_started',
        value: { nodeId: 'node_1', nodeType: 'trigger', nodeLabel: 'Start' },
      },
      {
        type: EventType.TEXT_MESSAGE_CHUNK,
        delta: 'Processing step...',
      },
      {
        type: EventType.CUSTOM,
        name: 'workflow_node_completed',
        value: { nodeId: 'node_1', output: { success: true }, durationMs: 15 },
      },
      {
        type: EventType.RUN_FINISHED,
        threadId: 'th_wf_1',
      },
    ];

    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const beforeRun = vi.fn();
    const beforeWorkflowNode = vi.fn();
    const afterWorkflowNode = vi.fn();
    const afterRun = vi.fn();

    const runtime = makeRuntime({
      fetchMock,
      hooks: {
        beforeRun,
        beforeWorkflowNode,
        afterWorkflowNode,
        afterRun,
      },
    });

    const response = await runtime.handle({
      method: 'POST',
      path: '/workflows/wf_123/stream',
      headers: {},
      query: {},
      body: { input: { query: 'test data' }, dryRun: false },
      userId: 'user-1',
    });

    expect(response.status).toBe(200);
    expect(response.kind).toBe('stream');
    if (response.kind !== 'stream') return;

    expect(response.headers['content-type']).toBe('text/event-stream');
    const runId = response.headers['x-persona-run-id'];
    expect(typeof runId).toBe('string');
    expect(runId?.length).toBeGreaterThan(0);

    const frames = await drain(response.body);
    expect(frames).toHaveLength(4);

    expect(beforeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'workflow',
        workflowId: 'wf_123',
        userId: 'user-1',
        input: { query: 'test data' },
      })
    );

    expect(beforeWorkflowNode).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf_123',
        nodeId: 'node_1',
        nodeType: 'trigger',
        nodeLabel: 'Start',
      })
    );

    expect(afterWorkflowNode).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf_123',
        nodeId: 'node_1',
      }),
      { success: true }
    );

    expect(afterRun).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'workflow',
        workflowId: 'wf_123',
      }),
      expect.objectContaining({
        text: 'Processing step...',
        eventCount: 4,
      })
    );
  });

  it('resumes an in-flight/recent workflow run with ?since=<seq>', async () => {
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'frame 0' },
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'frame 1' },
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'frame 2' },
      { type: EventType.RUN_FINISHED, threadId: 't1' },
    ];

    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const runtime = makeRuntime({ fetchMock });

    // Start original run
    const streamRes = await runtime.handle({
      method: 'POST',
      path: '/workflows/wf_abc/stream',
      headers: {},
      query: {},
      body: { input: {} },
      userId: 'user-1',
    });

    const runId = streamRes.headers['x-persona-run-id'];

    // Reattach with since=0 (meaning caller has received frame 0, desires frames 1, 2, 3)
    const resumeRes = await runtime.handle({
      method: 'GET',
      path: `/workflows/runs/${runId}/resume`,
      headers: {},
      query: { since: '0' },
      body: undefined,
      userId: 'user-1',
    });

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.kind).toBe('stream');
    if (resumeRes.kind !== 'stream') return;

    const replayedFrames = await drain(resumeRes.body);
    expect(replayedFrames).toEqual([
      `data: ${JSON.stringify(events[1])}\n\n`,
      `data: ${JSON.stringify(events[2])}\n\n`,
      `data: ${JSON.stringify(events[3])}\n\n`,
    ]);
  });
});
