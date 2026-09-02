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
    externalUserId: 'sabik-42',
    fetch: fetchMock,
  });
}

describe('MemoryResource', () => {
  it('list() GETs /memory and sends x-persona-external-user-id', async () => {
    const data = {
      userFiles: [{ scope: 'user', path: '/memories/user/index.md', content: '# hi' }],
      agentMemories: [],
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.memory.list();
    expect(result).toEqual(data);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/memory');
    expect((init.headers as Record<string, string>)['x-persona-external-user-id']).toBe('sabik-42');
  });

  it('getFile() sends path/scope/agentId as query params', async () => {
    const file = { scope: 'agent', agentId: 'a1', path: '/x.md', content: 'hi' };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: file })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.memory.getFile({ path: '/x.md', scope: 'agent', agentId: 'a1' });
    expect(result).toEqual(file);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      'https://api.example.com/api/v1/developer/memory/file?path=%2Fx.md&scope=agent&agentId=a1'
    );
  });

  it('writeFile() PUTs the input as the JSON body', async () => {
    const written = {
      scope: 'user',
      path: '/memories/user/prefs.md',
      content: 'likes concise answers',
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ success: true, data: written }, 201)
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const result = await client.memory.writeFile({
      path: '/memories/user/prefs.md',
      content: 'likes concise answers',
    });
    expect(result).toEqual(written);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/memory/file');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      path: '/memories/user/prefs.md',
      content: 'likes concise answers',
    });
  });

  it('deleteFile() DELETEs with path/scope/agentId as query params', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);

    await client.memory.deleteFile({ path: '/x.md' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/memory/file?path=%2Fx.md');
    expect(init.method).toBe('DELETE');
  });
});
