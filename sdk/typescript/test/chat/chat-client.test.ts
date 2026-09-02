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

function makeClient(fetchMock: typeof fetch) {
  return new PersonaClient({
    baseUrl: 'https://api.example.com',
    credential: 'key.secret',
    externalUserId: 'sabik-42',
    fetch: fetchMock,
  });
}

describe('ChatClient', () => {
  it('stream() sends x-agent-id (and x-thread-id when provided) and yields parsed events in order', async () => {
    const events = [
      { type: EventType.RUN_STARTED, threadId: 't1', runId: 'r1' },
      { type: EventType.TEXT_MESSAGE_CHUNK, messageId: 'm1', role: 'assistant', delta: 'Hello' },
      { type: EventType.TEXT_MESSAGE_CHUNK, messageId: 'm1', role: 'assistant', delta: ', world!' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const received: unknown[] = [];
    for await (const event of client.chat.stream('agent-1', {
      messages: [{ role: 'user', content: 'hi' }],
      threadId: 'thread-1',
    })) {
      received.push(event);
    }

    expect(received).toEqual(events);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/agui');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-agent-id']).toBe('agent-1');
    expect(headers['x-thread-id']).toBe('thread-1');
    expect(headers['x-persona-external-user-id']).toBe('sabik-42');
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [{ role: 'user', content: 'hi' }],
      resume: undefined,
    });
  });

  it('stream() omits x-thread-id when not provided (implicit deterministic thread)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([]));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    for await (const _event of client.chat.stream('agent-1', { messages: [] })) {
      // drain
    }

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-thread-id']).toBeUndefined();
  });

  it('sendMessage() assembles TEXT_MESSAGE_CHUNK deltas into the final text', async () => {
    const events = [
      { type: EventType.RUN_STARTED, threadId: 't1', runId: 'r1' },
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'The answer ' },
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: 'is 42.' },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.chat.sendMessage('agent-1', {
      messages: [{ role: 'user', content: 'What is the answer?' }],
    });

    expect(result.text).toBe('The answer is 42.');
    expect(result.interrupt).toBeUndefined();
    expect(result.events).toEqual(events);
  });

  it('sendMessage() surfaces a hitl_request CUSTOM event as a ChatInterrupt', async () => {
    const events = [
      { type: EventType.RUN_STARTED, threadId: 't1', runId: 'r1' },
      { type: EventType.TEXT_MESSAGE_CHUNK, delta: "I'd like to delete the agent, confirm?" },
      {
        type: EventType.CUSTOM,
        name: 'hitl_request',
        value: { actionRequests: [{ action: 'delete_agent' }], reviewConfigs: [] },
      },
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.chat.sendMessage('agent-1', {
      messages: [{ role: 'user', content: 'delete it' }],
    });

    expect(result.interrupt).toEqual({
      kind: 'hitl',
      value: { actionRequests: [{ action: 'delete_agent' }], reviewConfigs: [] },
    });
  });

  it('sendMessage() surfaces a clarification_request CUSTOM event as a ChatInterrupt', async () => {
    const events = [
      {
        type: EventType.CUSTOM,
        name: 'clarification_request',
        value: { questions: ['Which provider?'], currentIndex: 0 },
      },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.chat.sendMessage('agent-1', { messages: [] });
    expect(result.interrupt).toEqual({
      kind: 'clarification',
      value: { questions: ['Which provider?'], currentIndex: 0 },
    });
  });

  it('contextOverride is forwarded in the request body', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([]));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.chat.sendMessage('agent-1', {
      messages: [{ role: 'user', content: 'hi' }],
      contextOverride: 'stage=seed, sector=fintech',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).contextOverride).toBe('stage=seed, sector=fintech');
  });

  it('sendMessage() surfaces a RUN_ERROR event as ChatResult.error', async () => {
    const events = [
      { type: EventType.RUN_STARTED, threadId: 't1', runId: 'r1' },
      {
        type: EventType.RUN_ERROR,
        code: 'PROVIDER_AUTH_ERROR',
        message:
          'Provider "OpenAI" has invalid credentials. Update its API key in Settings and try again.',
        retryable: false,
        providerName: 'openai',
      },
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(events));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.chat.sendMessage('agent-1', { messages: [] });

    expect(result.error).toEqual({
      type: EventType.RUN_ERROR,
      code: 'PROVIDER_AUTH_ERROR',
      message:
        'Provider "OpenAI" has invalid credentials. Update its API key in Settings and try again.',
      retryable: false,
      providerName: 'openai',
    });
    expect(result.interrupt).toBeUndefined();
  });

  it('resume payload is forwarded in the request body to continue a paused run', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([]));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.chat.sendMessage('agent-1', {
      messages: [],
      resume: { decisions: [{ action: 'delete_agent', decision: 'approve' }] },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).resume).toEqual({
      decisions: [{ action: 'delete_agent', decision: 'approve' }],
    });
  });

  it('handles SSE frames split across multiple stream chunks', async () => {
    const encoder = new TextEncoder();
    const fullFrame = `data: ${JSON.stringify({ type: EventType.TEXT_MESSAGE_CHUNK, delta: 'split' })}\n\n`;
    const splitPoint = Math.floor(fullFrame.length / 2);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(fullFrame.slice(0, splitPoint)));
        controller.enqueue(encoder.encode(fullFrame.slice(splitPoint)));
        controller.close();
      },
    });
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const received: unknown[] = [];
    for await (const event of client.chat.stream('agent-1', { messages: [] })) {
      received.push(event);
    }

    expect(received).toEqual([{ type: EventType.TEXT_MESSAGE_CHUNK, delta: 'split' }]);
  });
});
