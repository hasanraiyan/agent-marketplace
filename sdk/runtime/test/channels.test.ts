import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';
import { computeTwilioSignature } from '../src/routes/channels.js';
import type { TwilioChannelOptions } from '../src/index.js';

const AUTH_TOKEN = 'test-auth-token';
const HOST = 'app.example.com';

function twilioOptions(
  overrides: Partial<TwilioChannelOptions> = {}
): TwilioChannelOptions {
  return {
    authToken: AUTH_TOKEN,
    publicUrl: `https://${HOST}`,
    agentId: 'agent_1',
    resolveUser: async ({ from }) =>
      from.replace(/^whatsapp:/i, '') === '+919876543210'
        ? { externalUserId: 'user_2ab' }
        : null,
    ...overrides,
  };
}

/** Signs the URL + form params exactly the way Twilio does for a POST webhook. */
async function signedHeaders(body: Record<string, string>, path: string) {
  const url = `https://${HOST}${path}`;
  const signature = await computeTwilioSignature(AUTH_TOKEN, url, body);
  return {
    host: HOST,
    'x-forwarded-proto': 'https',
    'content-type': 'application/x-www-form-urlencoded',
    'x-twilio-signature': signature,
  };
}

describe('twilio channel routes', () => {
  it('are absent unless configured', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock });

    const response = await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/voice',
      headers: {},
      query: {},
      body: { From: '+919876543210' },
      userId: null,
    });

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /channels/twilio/voice returns TwiML pointing at the media stream', async () => {
    const session = {
      ticket: 'payload.signature',
      streamUrl: 'wss://api.example.com/api/v1/twilio/media-stream?ticket=payload.signature',
      wsUrl: 'wss://api.example.com/api/v1/twilio/media-stream?ticket=payload.signature',
      expiresAt: '2026-01-01T00:01:00.000Z',
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(session));
    const runtime = makeRuntime({ fetchMock, channels: { twilio: twilioOptions() } });
    const body = { From: '+919876543210', To: '+14155238886', CallSid: 'CA123' };
    const headers = await signedHeaders(body, '/channels/twilio/voice');

    const response = await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/voice',
      headers,
      query: {},
      body,
      userId: null,
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/xml');
    if (response.kind === 'buffered') {
      expect(response.body).toContain('<Connect><Stream url=');
      expect(response.body).toContain(session.streamUrl.replace(/&/g, '&amp;'));
    }

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/v1/developer/voice/telephony/sessions');
    const requestHeaders = init.headers as Record<string, string>;
    expect(requestHeaders['x-agent-id']).toBe('agent_1');
    expect(requestHeaders['x-persona-external-user-id']).toBe('user_2ab');
    expect(JSON.parse(init.body as string)).toEqual({
      from: '+919876543210',
      to: '+14155238886',
      callSid: 'CA123',
    });
  });

  it('rejects a request whose signature does not verify', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock, channels: { twilio: twilioOptions() } });

    const response = await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/voice',
      headers: {
        host: HOST,
        'x-forwarded-proto': 'https',
        'x-twilio-signature': 'not-a-real-signature',
      },
      query: {},
      body: { From: '+919876543210' },
      userId: null,
    });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a request with no signature header at all', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock, channels: { twilio: twilioOptions() } });

    const response = await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/voice',
      headers: { host: HOST, 'x-forwarded-proto': 'https' },
      query: {},
      body: { From: '+919876543210' },
      userId: null,
    });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a call from an unknown number without calling Persona', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock, channels: { twilio: twilioOptions() } });
    const body = { From: '+15550000000', To: '+14155238886', CallSid: 'CA999' };
    const headers = await signedHeaders(body, '/channels/twilio/voice');

    const response = await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/voice',
      headers,
      query: {},
      body,
      userId: null,
    });

    expect(response.status).toBe(200);
    if (response.kind === 'buffered') expect(response.body).toContain('<Reject/>');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('speaks a fallback instead of failing when the session cannot start', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }));
    const runtime = makeRuntime({
      fetchMock,
      mode: 'development',
      channels: { twilio: twilioOptions({ voiceFallback: 'All agents are busy.' }) },
    });
    const body = { From: '+919876543210', To: '+14155238886', CallSid: 'CA1' };
    const headers = await signedHeaders(body, '/channels/twilio/voice');

    const response = await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/voice',
      headers,
      query: {},
      body,
      userId: null,
    });

    expect(response.status).toBe(200);
    if (response.kind === 'buffered') {
      expect(response.body).toContain('<Say>All agents are busy.</Say>');
      expect(response.body).toContain('<Hangup/>');
    }
  });

  it('POST /channels/twilio/message replies with the agent text as TwiML', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ agentId: 'agent_1', reply: 'It shipped <today>.', threadId: 'agui-t' })
    );
    const runtime = makeRuntime({ fetchMock, channels: { twilio: twilioOptions() } });
    const body = {
      From: 'whatsapp:+919876543210',
      To: 'whatsapp:+14155238886',
      Body: 'Where is my order?',
      MessageSid: 'SM1',
      ProfileName: 'Raiyan',
    };
    const headers = await signedHeaders(body, '/channels/twilio/message');

    const response = await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/message',
      headers,
      query: {},
      body,
      userId: null,
    });

    expect(response.status).toBe(200);
    if (response.kind === 'buffered') {
      // XML-escaped so the reply can never break out of the TwiML element.
      expect(response.body).toContain('<Message>It shipped &lt;today&gt;.</Message>');
    }

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/v1/developer/messages/agent/reply');
    expect((init.headers as Record<string, string>)['x-persona-external-user-id']).toBe('user_2ab');
    expect(JSON.parse(init.body as string)).toEqual({
      agentId: 'agent_1',
      text: 'Where is my order?',
      displayName: 'Raiyan',
    });
  });

  it('replies with the configured fallback when the agent turn fails', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 502 }));
    const runtime = makeRuntime({
      fetchMock,
      mode: 'development',
      channels: { twilio: twilioOptions({ messageFallback: 'Please try again later.' }) },
    });
    const body = {
      From: 'whatsapp:+919876543210',
      To: 'whatsapp:+14155238886',
      Body: 'Hi',
      MessageSid: 'SM2',
    };
    const headers = await signedHeaders(body, '/channels/twilio/message');

    const response = await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/message',
      headers,
      query: {},
      body,
      userId: null,
    });

    expect(response.status).toBe(200);
    if (response.kind === 'buffered') {
      expect(response.body).toContain('<Message>Please try again later.</Message>');
    }
  });

  it('ignores a media-only message without running the agent', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    const runtime = makeRuntime({ fetchMock, channels: { twilio: twilioOptions() } });
    const body = {
      From: 'whatsapp:+919876543210',
      To: 'whatsapp:+14155238886',
      Body: '',
      NumMedia: '1',
      MessageSid: 'SM3',
    };
    const headers = await signedHeaders(body, '/channels/twilio/message');

    const response = await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/message',
      headers,
      query: {},
      body,
      userId: null,
    });

    expect(response.status).toBe(200);
    if (response.kind === 'buffered') expect(response.body).toContain('<Response></Response>');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fires onVoiceSessionCreate for a resolved telephony caller', async () => {
    const onVoiceSessionCreate = vi.fn();
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ticket: 't',
        streamUrl: 'wss://api.example.com/media-stream?ticket=t',
        wsUrl: 'wss://api.example.com/media-stream?ticket=t',
        expiresAt: 'x',
      })
    );
    const runtime = makeRuntime({
      fetchMock,
      hooks: { onVoiceSessionCreate },
      channels: { twilio: twilioOptions() },
    });
    const body = { From: '+919876543210', To: '+14155238886', CallSid: 'CA7' };
    const headers = await signedHeaders(body, '/channels/twilio/voice');

    await runtime.handle({
      method: 'POST',
      path: '/channels/twilio/voice',
      headers,
      query: {},
      body,
      userId: null,
    });

    expect(onVoiceSessionCreate).toHaveBeenCalledWith({
      userId: 'user_2ab',
      agentId: 'agent_1',
    });
  });

  it("passes threadId and agentId override from resolver to voice session", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ticket: "t",
        streamUrl: "wss://api.example.com/media-stream?ticket=t",
        wsUrl: "wss://api.example.com/media-stream?ticket=t",
        expiresAt: "x",
      })
    );
    const runtime = makeRuntime({
      fetchMock,
      channels: {
        twilio: twilioOptions({
          resolveUser: async () => ({
            externalUserId: "user_custom",
            agentId: "agent_override",
            threadId: "thread_123",
          }),
        }),
      },
    });
    const body = { From: "+919876543210", To: "+14155238886", CallSid: "CA8" };
    const headers = await signedHeaders(body, "/channels/twilio/voice");

    await runtime.handle({
      method: "POST",
      path: "/channels/twilio/voice",
      headers,
      query: {},
      body,
      userId: null,
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const reqHeaders = init.headers as Record<string, string>;
    expect(reqHeaders["x-agent-id"]).toBe("agent_override");
    expect(reqHeaders["x-persona-external-user-id"]).toBe("user_custom");
    expect(reqHeaders["x-thread-id"]).toBe("thread_123");
  });

  it("passes threadId and agentId override from resolver to message reply", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ agentId: "agent_override", reply: "Custom reply", threadId: "thread_123" })
    );
    const runtime = makeRuntime({
      fetchMock,
      channels: {
        twilio: twilioOptions({
          resolveUser: async () => ({
            externalUserId: "user_custom",
            agentId: "agent_override",
            threadId: "thread_123",
          }),
        }),
      },
    });
    const body = {
      From: "whatsapp:+919876543210",
      To: "whatsapp:+14155238886",
      Body: "Hello",
      MessageSid: "SM9",
    };
    const headers = await signedHeaders(body, "/channels/twilio/message");

    const response = await runtime.handle({
      method: "POST",
      path: "/channels/twilio/message",
      headers,
      query: {},
      body,
      userId: null,
    });

    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const reqHeaders = init.headers as Record<string, string>;
    expect(reqHeaders["x-persona-external-user-id"]).toBe("user_custom");
    const parsedBody = JSON.parse(init.body as string);
    expect(parsedBody.agentId).toBe("agent_override");
    expect(parsedBody.threadId).toBe("thread_123");
  });
});