import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

describe('voice routes', () => {
  it('POST /voice/sessions requires agentId, mints a ticket, and fires onVoiceSessionCreate', async () => {
    const onVoiceSessionCreate = vi.fn();
    const ticket = {
      ticket: 'payload.signature',
      wsUrl: 'wss://api.example.com/api/v1/developer/voice?ticket=payload.signature',
      expiresAt: '2026-01-01T00:01:00.000Z',
      session: {
        model: 'gemini-3.1-flash-live-preview',
        voice: 'Zephyr',
        inputSampleRate: 16000,
        outputSampleRate: 24000,
        maxDurationMs: 900000,
      },
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(ticket, 200));
    const runtime = makeRuntime({ fetchMock, hooks: { onVoiceSessionCreate } });

    const response = await runtime.handle({
      method: 'POST',
      path: '/voice/sessions',
      headers: {},
      query: {},
      body: { agentId: 'a1' },
      userId: null,
    });

    expect(response.status).toBe(201);
    expect(response.kind).toBe('buffered');
    if (response.kind === 'buffered') expect(JSON.parse(response.body)).toEqual(ticket);

    expect(onVoiceSessionCreate).toHaveBeenCalledWith({ userId: 'user-1', agentId: 'a1' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/developer/voice/sessions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-agent-id']).toBe('a1');
  });

  it('POST /voice/sessions without agentId returns 400 without calling the API', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/voice/sessions',
      headers: {},
      query: {},
      body: {},
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is always on — reachable with no capabilities enabled', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ ticket: 't', wsUrl: 'wss://x', expiresAt: 'x', session: {} }, 201)
    );
    const runtime = makeRuntime({ fetchMock, capabilities: {} });

    const response = await runtime.handle({
      method: 'POST',
      path: '/voice/sessions',
      headers: {},
      query: {},
      body: { agentId: 'a1' },
      userId: null,
    });

    expect(response.status).toBe(201);
  });
});
