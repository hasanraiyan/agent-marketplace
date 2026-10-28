import { describe, expect, it, vi } from 'vitest';
import { PersonaClient } from '../../src/client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeClient(fetchMock: typeof fetch) {
  return new PersonaClient({
    baseUrl: 'https://api.example.com',
    credential: 'key.secret',
    fetch: fetchMock,
  });
}

const delivery = {
  channel: 'whatsapp',
  to: '+919876543210',
  from: '+14155238886',
  messageSids: ['SM_1'],
  status: 'queued',
  parts: 1,
};

describe('MessagesResource', () => {
  it('send() POSTs the input to /api/v1/developer/messages and returns the delivery', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: delivery })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.messages.send({
      to: '+919876543210',
      channel: 'whatsapp',
      body: 'Your order shipped!',
    });

    expect(result).toEqual(delivery);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      to: '+919876543210',
      channel: 'whatsapp',
      body: 'Your order shipped!',
    });
  });

  it('send() forwards a WhatsApp template instead of a body', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: delivery })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.messages.send({
      to: '+919876543210',
      channel: 'whatsapp',
      contentSid: 'HX123',
      contentVariables: { '1': 'Raiyan', '2': 'ORD-42' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      to: '+919876543210',
      channel: 'whatsapp',
      contentSid: 'HX123',
      contentVariables: { '1': 'Raiyan', '2': 'ORD-42' },
    });
  });

  it('sendFromAgent() POSTs to /messages/agent and returns agentId with the delivery', async () => {
    const withAgent = { agentId: 'agent_1', ...delivery };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: withAgent })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.messages.sendFromAgent({
      agentId: 'agent_1',
      to: '+919876543210',
      prompt: 'Remind the customer about tomorrow.',
    });

    expect(result).toEqual(withAgent);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/messages/agent');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      agentId: 'agent_1',
      to: '+919876543210',
      prompt: 'Remind the customer about tomorrow.',
    });
  });

  it('propagates an AGENT_RUN_FAILED error as a typed API error', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: false, message: 'Agent run failed.', code: 'AGENT_RUN_FAILED' }, 502)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await expect(
      client.messages.sendFromAgent({
        agentId: 'agent_1',
        to: '+919876543210',
        prompt: 'Hello',
      })
    ).rejects.toMatchObject({ code: 'AGENT_RUN_FAILED', statusCode: 502 });
  });

  it('does not require an asserted external user', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: delivery })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.messages.send({ to: '+919876543210', body: 'hi' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-persona-external-user-id']).toBeUndefined();
  });
});
