import { describe, expect, it, vi } from 'vitest';
import { PersonaClient } from '../../src/client.js';
import { EventType } from '../../src/types/chat.js';

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

describe('ArchitectClient', () => {
  it('stream() sends x-thread-id when threadId is provided', async () => {
    const events = [
      { type: EventType.RUN_STARTED, threadId: 'architect-thread-1', runId: 'r1' },
      { type: EventType.RUN_FINISHED, threadId: 'architect-thread-1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    const received: unknown[] = [];
    for await (const event of client.architect.stream({
      messages: [{ role: 'user', content: 'build me an agent' }],
      threadId: 'architect-thread-1',
    })) {
      received.push(event);
    }

    expect(received).toEqual(events);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/architect/agui');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-thread-id']).toBe('architect-thread-1');
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [{ role: 'user', content: 'build me an agent' }],
      resume: undefined,
    });
  });

  it('stream() omits x-thread-id when not provided (implicit deterministic conversation)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([]));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    for await (const _event of client.architect.stream({ messages: [] })) {
      // drain
    }

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-thread-id']).toBeUndefined();
  });

  it('sendMessage() assembles TEXT_MESSAGE_CHUNK deltas into the final text', async () => {
    const events = [
      { type: EventType.RUN_STARTED, threadId: 't1', runId: 'r1' },
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'Created ' },
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'the agent.' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.architect.sendMessage({
      messages: [{ role: 'user', content: 'Create an agent that...' }],
    });

    expect(result.text).toBe('Created the agent.');
    expect(result.interrupt).toBeUndefined();
    expect(result.events).toEqual(events);
  });

  it('sendMessage() surfaces a hitl_request CUSTOM event as a ChatInterrupt', async () => {
    const events = [
      {
        type: EventType.CUSTOM,
        name: 'hitl_request',
        value: { actionRequests: [{ action: 'manage_agent' }], reviewConfigs: [] },
      },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.architect.sendMessage({ messages: [] });
    expect(result.interrupt).toEqual({
      kind: 'hitl',
      value: { actionRequests: [{ action: 'manage_agent' }], reviewConfigs: [] },
    });
  });

  it('resume payload is forwarded in the request body to continue a paused run', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([]));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.architect.sendMessage({
      messages: [],
      resume: { decisions: [{ action: 'manage_agent', decision: 'approve' }] },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).resume).toEqual({
      decisions: [{ action: 'manage_agent', decision: 'approve' }],
    });
  });
});
