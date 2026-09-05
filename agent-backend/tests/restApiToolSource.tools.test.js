import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: {
    encrypt: jest.fn((v) => `enc:${v}`),
    decrypt: jest.fn((v) => String(v).replace(/^enc:/, '')),
  },
}));

const { resolveRestApiToolSourceTools } = await import(
  '../src/modules/restApiToolSources/restApiToolSource.tools.js'
);

const context = { principalType: 'PersonaUser', personaUserId: 'u1' };

function manifestOk(tools) {
  return { ok: true, json: async () => ({ tools }) };
}

function agentWithSources(sources) {
  return { restApiToolSources: sources };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('resolveRestApiToolSourceTools', () => {
  it('returns [] when the agent has no attached sources', async () => {
    expect(await resolveRestApiToolSourceTools({}, 'u1', context)).toEqual([]);
    expect(await resolveRestApiToolSourceTools({ restApiToolSources: [] }, 'u1', context)).toEqual([]);
  });

  it('builds one namespaced tool per manifest entry, fetched live', async () => {
    global.fetch.mockResolvedValue(
      manifestOk([{ name: 'Get Profile', method: 'GET', url: 'https://x.example.com/me' }])
    );

    const tools = await resolveRestApiToolSourceTools(
      agentWithSources([{ name: 'Coursify', isEnabled: true, authType: 'none', url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://x.example.com/manifest',
      expect.objectContaining({ headers: {} })
    );
    expect(tools).toHaveLength(1);
    // slugifyToolName collapses the `__` separator's repeated underscores.
    expect(tools[0].name).toBe('coursify_get_profile');
  });

  it('sends a decrypted bearer token for apiKey auth sources', async () => {
    global.fetch.mockResolvedValue(manifestOk([]));

    await resolveRestApiToolSourceTools(
      agentWithSources([
        {
          name: 'Coursify',
          isEnabled: true,
          authType: 'apiKey',
          apiKeyEncrypted: 'enc:secret123',
          url: 'https://x.example.com/manifest',
        },
      ]),
      'u1',
      context
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://x.example.com/manifest',
      expect.objectContaining({ headers: { Authorization: 'Bearer secret123' } })
    );
  });

  it('skips a disabled source without fetching it', async () => {
    const tools = await resolveRestApiToolSourceTools(
      agentWithSources([{ name: 'Coursify', isEnabled: false, url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(tools).toEqual([]);
  });

  it('skips (never throws for) an unreachable source', async () => {
    global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const tools = await resolveRestApiToolSourceTools(
      agentWithSources([{ name: 'Coursify', isEnabled: true, url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );
    expect(tools).toEqual([]);
  });

  it('skips (never throws for) a non-2xx response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    const tools = await resolveRestApiToolSourceTools(
      agentWithSources([{ name: 'Coursify', isEnabled: true, url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );
    expect(tools).toEqual([]);
  });

  it('skips (never throws for) a manifest that fails schema validation', async () => {
    global.fetch.mockResolvedValue(manifestOk([{ name: 'Get Profile' /* missing method/url */ }]));
    const tools = await resolveRestApiToolSourceTools(
      agentWithSources([{ name: 'Coursify', isEnabled: true, url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );
    expect(tools).toEqual([]);
  });

  it('continues to other sources after one fails', async () => {
    global.fetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(manifestOk([{ name: 'Ping', method: 'GET', url: 'https://y.example.com/ping' }]));

    const tools = await resolveRestApiToolSourceTools(
      agentWithSources([
        { name: 'Down', isEnabled: true, url: 'https://x.example.com/manifest' },
        { name: 'Up', isEnabled: true, url: 'https://y.example.com/manifest' },
      ]),
      'u1',
      context
    );

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('up_ping');
  });
});
