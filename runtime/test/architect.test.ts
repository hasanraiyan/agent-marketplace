import { describe, expect, it, vi } from 'vitest';
import { EventType } from '@personaai/sdk';
import { sseResponse, makeRuntime } from './helpers.js';

function withCapability(overrides: Parameters<typeof makeRuntime>[0]) {
  return makeRuntime({ ...overrides, capabilities: { architect: true } });
}

async function drain(body: AsyncIterable<string>): Promise<string[]> {
  const frames: string[] = [];
  for await (const chunk of body) frames.push(chunk);
  return frames;
}

describe('POST /architect + GET /architect/:runId/resume', () => {
  it('streams a run and fires beforeRun/afterRun with kind: architect, no agentId', async () => {
    const beforeRun = vi.fn();
    const afterRun = vi.fn();
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'Creating the agent…' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const runtime = withCapability({ fetchMock, hooks: { beforeRun, afterRun } });

    const response = await runtime.handle({
      method: 'POST',
      path: '/architect',
      headers: {},
      query: {},
      body: { messages: [{ role: 'user', content: 'Build me a support bot' }] },
      userId: null,
    });

    expect(response.status).toBe(200);
    expect(response.headers['x-persona-run-id']).toBeTruthy();
    expect(beforeRun).toHaveBeenCalledWith({
      userId: 'user-1',
      kind: 'architect',
      agentId: undefined,
      threadId: undefined,
      messages: [{ role: 'user', content: 'Build me a support bot' }],
    });

    if (response.kind !== 'stream') return;
    const frames = await drain(response.body);
    expect(frames).toEqual(events.map((e) => `data: ${JSON.stringify(e)}\n\n`));
    expect(afterRun).toHaveBeenCalledTimes(1);
  });

  it('POST /architect without messages returns 400', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([]));
    const runtime = withCapability({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/architect',
      headers: {},
      query: {},
      body: {},
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a chat run id cannot be resumed via /architect/:runId/resume, and vice versa', async () => {
    const events = [{ type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' }];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    // Both capabilities on so both routes exist to test cross-kind isolation.
    const runtime = makeRuntime({ fetchMock, capabilities: { architect: true } });

    const chatResponse = await runtime.handle({
      method: 'POST',
      path: '/chat',
      headers: {},
      query: {},
      body: { agentId: 'agent-1', messages: [] },
      userId: null,
    });
    if (chatResponse.kind !== 'stream') throw new Error('expected stream');
    const chatRunId = chatResponse.headers['x-persona-run-id']!;
    await drain(chatResponse.body);

    const crossResume = await runtime.handle({
      method: 'GET',
      path: `/architect/${chatRunId}/resume`,
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });
    expect(crossResume.status).toBe(404);

    const architectResponse = await runtime.handle({
      method: 'POST',
      path: '/architect',
      headers: {},
      query: {},
      body: { messages: [] },
      userId: null,
    });
    if (architectResponse.kind !== 'stream') throw new Error('expected stream');
    const architectRunId = architectResponse.headers['x-persona-run-id']!;
    await drain(architectResponse.body);

    const reverseCrossResume = await runtime.handle({
      method: 'GET',
      path: `/chat/${architectRunId}/resume`,
      headers: {},
      query: {},
      body: undefined,
      userId: null,
    });
    expect(reverseCrossResume.status).toBe(404);
  });

  it('reconnect works the same way as /chat: replays missed frames after a partial read', async () => {
    const events = [
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'one' },
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'two' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const afterRun = vi.fn();
    const runtime = withCapability({ fetchMock, hooks: { afterRun } });

    const first = await runtime.handle({
      method: 'POST',
      path: '/architect',
      headers: {},
      query: {},
      body: { messages: [] },
      userId: null,
    });
    if (first.kind !== 'stream') throw new Error('expected stream');
    const runId = first.headers['x-persona-run-id']!;

    const iterator = first.body[Symbol.asyncIterator]();
    const firstFrame = await iterator.next();
    expect(firstFrame.value).toBe(`data: ${JSON.stringify(events[0])}\n\n`);
    await iterator.return?.();

    await vi.waitFor(() => expect(afterRun).toHaveBeenCalledTimes(1));

    const resumed = await runtime.handle({
      method: 'GET',
      path: `/architect/${runId}/resume`,
      headers: {},
      query: { since: '0' },
      body: undefined,
      userId: null,
    });
    if (resumed.kind !== 'stream') throw new Error('expected stream');
    const missed = await drain(resumed.body);
    expect(missed).toEqual([events[1], events[2]].map((e) => `data: ${JSON.stringify(e)}\n\n`));
  });
});
