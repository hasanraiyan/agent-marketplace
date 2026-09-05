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

describe('RestToolsResource', () => {
  it('create() POSTs to /api/v1/developer/rest-tools', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { _id: 't1' } }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.restTools.create({ name: 'Get profile', method: 'GET', url: 'https://x.example.com' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/rest-tools');
    expect(init.method).toBe('POST');
  });

  it('test() POSTs to /api/v1/developer/rest-tools/test', async () => {
    const result = { status: 200, ok: true, body: {}, mapped: {} };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: result })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const out = await client.restTools.test({ toolId: 't1', testValues: { userId: '1' } });

    expect(out).toEqual(result);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/rest-tools/test');
    expect(init.method).toBe('POST');
  });
});
