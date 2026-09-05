import { describe, expect, it, vi } from 'vitest';
import { PersonaClient } from '../../src/client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
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

describe('VoiceResource', () => {
  it('createSession() posts to the sessions endpoint with x-agent-id and returns the ticket', async () => {
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
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: ticket })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    const result = await client.voice.createSession('agent_1');
    expect(result).toEqual(ticket);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/voice/sessions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-agent-id']).toBe('agent_1');
  });

  it('createSession() with a threadId sends x-thread-id to resume that conversation', async () => {
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
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: ticket })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    const result = await client.voice.createSession('agent_1', {
      threadId: 'thread_9',
    });
    expect(result).toEqual(ticket);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/voice/sessions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-agent-id']).toBe('agent_1');
    expect((init.headers as Record<string, string>)['x-thread-id']).toBe('thread_9');
  });

  it('propagates a VOICE_PROVIDER_REQUIRED error as a typed API error', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(
        {
          success: false,
          message: 'No Gemini provider configured.',
          code: 'VOICE_PROVIDER_REQUIRED',
        },
        422
      )
    );
    const client = makeClient(fetchMock as unknown as typeof fetch, 'sabik-42');

    await expect(client.voice.createSession('agent_1')).rejects.toMatchObject({
      code: 'VOICE_PROVIDER_REQUIRED',
      statusCode: 422,
    });
  });
});
