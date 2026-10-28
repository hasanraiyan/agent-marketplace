import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeRuntime } from './helpers.js';

const delivery = {
  channel: 'sms',
  to: '+15550001111',
  from: '+15550002222',
  messageSids: ['SM1'],
  status: 'queued',
  parts: 1,
};

function runtimeWithMessages(fetchMock: ReturnType<typeof vi.fn>) {
  return makeRuntime({ fetchMock, capabilities: { messages: true } });
}

describe('messaging routes', () => {
  it('POST /messages proxies a plain send to /api/v1/developer/messages', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(delivery, 200)
    );
    const runtime = runtimeWithMessages(fetchMock);

    const response = await runtime.handle({
      method: 'POST',
      path: '/messages',
      headers: {},
      query: {},
      body: { to: '+15550001111', body: 'Your order shipped!' },
      userId: null,
    });

    expect(response.status).toBe(200);
    expect(response.kind).toBe('buffered');
    if (response.kind === 'buffered') expect(JSON.parse(response.body)).toEqual(delivery);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/developer/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      to: '+15550001111',
      body: 'Your order shipped!',
    });
  });

  it('POST /messages forwards channel, media, and template fields', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ ...delivery, channel: 'whatsapp' }, 200)
    );
    const runtime = runtimeWithMessages(fetchMock);

    const response = await runtime.handle({
      method: 'POST',
      path: '/messages',
      headers: {},
      query: {},
      body: {
        to: '+15550001111',
        channel: 'whatsapp',
        contentSid: 'HX123',
        contentVariables: { '1': 'Raiyan' },
        mediaUrl: ['https://cdn.example.com/a.png'],
      },
      userId: null,
    });

    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      to: '+15550001111',
      channel: 'whatsapp',
      contentSid: 'HX123',
      contentVariables: { '1': 'Raiyan' },
      mediaUrl: ['https://cdn.example.com/a.png'],
    });
  });

  it('POST /messages requires "to" without calling the API', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = runtimeWithMessages(fetchMock);

    const response = await runtime.handle({
      method: 'POST',
      path: '/messages',
      headers: {},
      query: {},
      body: { body: 'hi' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /messages requires "body" or "contentSid" without calling the API', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = runtimeWithMessages(fetchMock);

    const response = await runtime.handle({
      method: 'POST',
      path: '/messages',
      headers: {},
      query: {},
      body: { to: '+15550001111' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /messages rejects an unsupported channel without calling the API', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = runtimeWithMessages(fetchMock);

    const response = await runtime.handle({
      method: 'POST',
      path: '/messages',
      headers: {},
      query: {},
      body: { to: '+15550001111', channel: 'email', body: 'hi' },
      userId: null,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /messages/agent proxies an agent-composed send', async () => {
    const agentDelivery = { ...delivery, agentId: 'a1' };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(agentDelivery, 200)
    );
    const runtime = runtimeWithMessages(fetchMock);

    const response = await runtime.handle({
      method: 'POST',
      path: '/messages/agent',
      headers: {},
      query: {},
      body: { agentId: 'a1', to: '+15550001111', prompt: 'Send the reminder.' },
      userId: null,
    });

    expect(response.status).toBe(200);
    if (response.kind === 'buffered') expect(JSON.parse(response.body)).toEqual(agentDelivery);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/developer/messages/agent');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      agentId: 'a1',
      to: '+15550001111',
      prompt: 'Send the reminder.',
    });
  });

  it('POST /messages/agent requires agentId, to, and prompt without calling the API', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const runtime = runtimeWithMessages(fetchMock);

    for (const body of [
      { to: '+15550001111', prompt: 'hi' },
      { agentId: 'a1', prompt: 'hi' },
      { agentId: 'a1', to: '+15550001111' },
    ]) {
      const response = await runtime.handle({
        method: 'POST',
        path: '/messages/agent',
        headers: {},
        query: {},
        body,
        userId: null,
      });
      expect(response.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is off by default — both routes 404 with no capabilities enabled', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(delivery));
    const runtime = makeRuntime({ fetchMock });

    for (const path of ['/messages', '/messages/agent']) {
      const response = await runtime.handle({
        method: 'POST',
        path,
        headers: {},
        query: {},
        body: { to: '+15550001111', body: 'hi', agentId: 'a1', prompt: 'hi' },
        userId: null,
      });
      expect(response.status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
