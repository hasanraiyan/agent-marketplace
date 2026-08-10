import { describe, expect, it, vi } from 'vitest';
import { PersonaClient } from '../src/client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('PersonaClient', () => {
  it('whoami() calls GET /api/v1/developer/whoami and returns the resolved context', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: { domain: 'proj-1', principalType: 'ProjectMachine', credentialId: 'cred-1' },
      })
    );

    const client = new PersonaClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.whoami();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/developer/whoami');
    expect(init.method).toBe('GET');
    expect(result).toEqual({
      domain: 'proj-1',
      principalType: 'ProjectMachine',
      credentialId: 'cred-1',
    });
  });

  it('resolves a ProjectRuntimeContext shape when externalUserId is set', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        success: true,
        data: {
          domain: 'proj-1',
          principalType: 'ProjectRuntime',
          credentialId: 'cred-1',
          externalUserId: 'sabik-42',
        },
      })
    );

    const client = new PersonaClient({
      baseUrl: 'https://api.example.com',
      credential: 'key.secret',
      externalUserId: 'sabik-42',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.whoami();
    expect(result.principalType).toBe('ProjectRuntime');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-persona-external-user-id']).toBe('sabik-42');
  });
});
