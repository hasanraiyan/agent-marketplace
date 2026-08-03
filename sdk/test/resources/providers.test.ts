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

describe('ProvidersResource', () => {
  it('create() POSTs to /api/v1/developer/providers with the input body', async () => {
    const provider = {
      id: 'p1',
      label: 'Prod OpenAI',
      baseURL: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: provider }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.providers.create({
      label: 'Prod OpenAI',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      defaultModel: 'gpt-4o',
      isDefault: true,
    });

    expect(result).toEqual(provider);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/providers');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ label: 'Prod OpenAI' });
  });

  it('create() sends an Idempotency-Key header when provided', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { id: 'p1' } }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.providers.create(
      {
        label: 'X',
        baseURL: 'https://api.example.com',
        apiKey: 'sk-test',
        defaultModel: 'gpt-4o',
      },
      'idem-key-1'
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('idem-key-1');
  });

  it('list() GETs the bare providers list, no query params', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [{ id: 'p1' }, { id: 'p2' }] })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const providers = await client.providers.list();
    expect(providers).toEqual([{ id: 'p1' }, { id: 'p2' }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/providers');
    expect(init.method).toBe('GET');
  });

  it('get() fetches a single Provider by id', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { id: 'p1', label: 'X' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.providers.get('p1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/providers/p1');
    expect(init.method).toBe('GET');
  });

  it('update() PATCHes with only the provided fields', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { id: 'p1', isDefault: false } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.providers.update('p1', { isDefault: false });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/providers/p1');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ isDefault: false }));
  });

  it('delete() DELETEs the Provider', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, message: 'Provider deleted successfully' })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.providers.delete('p1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/providers/p1');
    expect(init.method).toBe('DELETE');
  });

  it('testConnection() POSTs to the test-connection sub-route', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: { success: true, message: 'Connection successful.' } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.providers.testConnection('p1');
    expect(result).toEqual({ success: true, message: 'Connection successful.' });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/providers/p1/test-connection');
  });

  it('getModels() GETs the models sub-route and returns the model list', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const models = await client.providers.getModels('p1');
    expect(models).toEqual([{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/v1/developer/providers/p1/models');
  });

  it('getUsage() GETs the usage sub-route and returns agent count + preview', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const usage = await client.providers.getUsage('p1');
    expect(usage).toEqual({ agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/providers/p1/usage');
    expect(init.method).toBe('GET');
  });

  it('bulkDelete() POSTs { ids } to the bulk-delete sub-route and returns { deleted, failed }', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { deleted: ['p1'], failed: [{ id: 'p2', reason: 'Provider not found' }] },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.providers.bulkDelete(['p1', 'p2']);
    expect(result).toEqual({
      deleted: ['p1'],
      failed: [{ id: 'p2', reason: 'Provider not found' }],
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/providers/bulk-delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ ids: ['p1', 'p2'] });
  });
});
