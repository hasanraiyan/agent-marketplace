import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/projectSecret.service.js', () => ({
  default: {
    resolvePlaintext: jest.fn(),
  },
}));

const projectSecretService = (await import('../src/modules/projects/projectSecret.service.js')).default;
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
  projectSecretService.resolvePlaintext.mockReset();
  projectSecretService.resolvePlaintext.mockResolvedValue('secret123');
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

  it('sends a resolved bearer token for apiKey auth sources', async () => {
    global.fetch.mockResolvedValue(manifestOk([]));

    await resolveRestApiToolSourceTools(
      agentWithSources([
        {
          name: 'Coursify',
          isEnabled: true,
          authType: 'apiKey',
          secretRef: 'secret-1',
          url: 'https://x.example.com/manifest',
        },
      ]),
      'u1',
      context
    );

    expect(projectSecretService.resolvePlaintext).toHaveBeenCalledWith('secret-1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://x.example.com/manifest',
      expect.objectContaining({ headers: { Authorization: 'Bearer secret123' } })
    );
  });

  it("falls back to the source's own secretRef when a tool declares bearerSecret with none of its own", async () => {
    global.fetch
      .mockResolvedValueOnce(
        manifestOk([
          { name: 'Get Profile', method: 'GET', url: 'https://api.example.com/me', authType: 'bearerSecret' },
        ])
      )
      .mockResolvedValueOnce({ ok: true, text: async () => '{}' });

    const tools = await resolveRestApiToolSourceTools(
      agentWithSources([
        {
          name: 'Coursify',
          isEnabled: true,
          authType: 'apiKey',
          secretRef: 'source-secret-1',
          url: 'https://x.example.com/manifest',
        },
      ]),
      'u1',
      context
    );

    expect(tools).toHaveLength(1);
    await tools[0].func({});

    // Once for the manifest fetch itself, once for the tool's own call —
    // both via the source's secret, since the tool declared none of its own.
    expect(projectSecretService.resolvePlaintext).toHaveBeenCalledTimes(2);
    expect(projectSecretService.resolvePlaintext).toHaveBeenNthCalledWith(1, 'source-secret-1');
    expect(projectSecretService.resolvePlaintext).toHaveBeenNthCalledWith(2, 'source-secret-1');
    const toolCallInit = global.fetch.mock.calls[1][1];
    expect(toolCallInit.headers.Authorization).toBe('Bearer secret123');
  });

  it('skips (never throws for) a tool needing bearerSecret when neither it nor the source has a secret', async () => {
    global.fetch.mockResolvedValue(
      manifestOk([
        { name: 'Get Profile', method: 'GET', url: 'https://api.example.com/me', authType: 'bearerSecret' },
      ])
    );

    const tools = await resolveRestApiToolSourceTools(
      agentWithSources([
        { name: 'Coursify', isEnabled: true, authType: 'none', url: 'https://x.example.com/manifest' },
      ]),
      'u1',
      context
    );

    expect(tools).toEqual([]);
  });

  it("uses a tool's own secretRef instead of the source's when both are set", async () => {
    global.fetch
      .mockResolvedValueOnce(
        manifestOk([
          {
            name: 'Get Profile',
            method: 'GET',
            url: 'https://api.example.com/me',
            authType: 'bearerSecret',
            secretRef: 'tool-secret-1',
          },
        ])
      )
      .mockResolvedValueOnce({ ok: true, text: async () => '{}' });

    const tools = await resolveRestApiToolSourceTools(
      agentWithSources([
        {
          name: 'Coursify',
          isEnabled: true,
          authType: 'apiKey',
          secretRef: 'source-secret-1',
          url: 'https://x.example.com/manifest',
        },
      ]),
      'u1',
      context
    );

    await tools[0].func({});

    expect(projectSecretService.resolvePlaintext).toHaveBeenNthCalledWith(2, 'tool-secret-1');
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
