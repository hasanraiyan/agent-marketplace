import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/projectSecret.service.js', () => ({
  default: {
    resolvePlaintext: jest.fn(),
  },
}));

const projectSecretService = (await import('../src/modules/projects/projectSecret.service.js')).default;
const { resolveRcpSourceTools } = await import('../src/modules/rcpSources/rcpSource.tools.js');

const context = { principalType: 'PersonaUser', personaUserId: 'u1' };

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function manifestOk(tools, extra = {}) {
  return jsonResponse({ rcpVersion: '0.1', auth: { type: 'none' }, tools, ...extra });
}

function agentWithSources(sources) {
  return { rcpSources: sources };
}

beforeEach(() => {
  global.fetch = jest.fn();
  projectSecretService.resolvePlaintext.mockReset();
  projectSecretService.resolvePlaintext.mockResolvedValue('secret123');
});

describe('resolveRcpSourceTools', () => {
  it('returns [] when the agent has no attached sources', async () => {
    expect(await resolveRcpSourceTools({}, 'u1', context)).toEqual([]);
    expect(await resolveRcpSourceTools({ rcpSources: [] }, 'u1', context)).toEqual([]);
  });

  it('skips a disabled source without fetching it', async () => {
    const tools = await resolveRcpSourceTools(
      agentWithSources([{ name: 'Weather', isEnabled: false, url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(tools).toEqual([]);
  });

  it('builds one namespaced tool per discovered tool, discovered live via rcp-sdk', async () => {
    global.fetch.mockResolvedValueOnce(
      manifestOk([
        {
          name: 'get_weather',
          description: 'Get weather',
          method: 'GET',
          url: 'https://api.example.com/weather',
          params: [{ name: 'city', type: 'string', required: true }],
        },
      ])
    );

    const tools = await resolveRcpSourceTools(
      agentWithSources([
        { name: 'Weather Co', isEnabled: true, authType: 'none', url: 'https://x.example.com/manifest' },
      ]),
      'u1',
      context
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://x.example.com/manifest',
      expect.objectContaining({ headers: {} })
    );
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('weather_co__get_weather');
  });

  it('sends a resolved bearer token for header-auth sources', async () => {
    global.fetch.mockResolvedValueOnce(manifestOk([]));

    await resolveRcpSourceTools(
      agentWithSources([
        {
          name: 'Weather Co',
          isEnabled: true,
          authType: 'header',
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

  it('attaches the identity header only for a verified ProjectRuntime external user', async () => {
    global.fetch.mockResolvedValueOnce(manifestOk([]));

    const runtimeContext = {
      principalType: 'ProjectRuntime',
      externalUserId: 'ext-user-42',
    };

    await resolveRcpSourceTools(
      agentWithSources([{ name: 'Weather Co', isEnabled: true, url: 'https://x.example.com/manifest' }]),
      'u1',
      runtimeContext
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://x.example.com/manifest',
      expect.objectContaining({
        headers: { 'X-Persona-External-User-Id': 'ext-user-42' },
      })
    );
  });

  it('does not attach the identity header for a plain PersonaUser context', async () => {
    global.fetch.mockResolvedValueOnce(manifestOk([]));

    await resolveRcpSourceTools(
      agentWithSources([{ name: 'Weather Co', isEnabled: true, url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://x.example.com/manifest',
      expect.objectContaining({ headers: {} })
    );
  });

  it('calling the built tool hits the tool\'s own url and returns the mapped result', async () => {
    global.fetch
      .mockResolvedValueOnce(
        manifestOk([
          {
            name: 'get_weather',
            description: 'Get weather',
            method: 'GET',
            url: 'https://api.example.com/weather',
            queryParams: { city: '{{city}}' },
            params: [{ name: 'city', type: 'string', required: true }],
            responseMappings: { temp: '@temp' },
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse({ temp: 21 }));

    const tools = await resolveRcpSourceTools(
      agentWithSources([{ name: 'Weather Co', isEnabled: true, url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );

    const result = await tools[0].func({ city: 'Paris' });
    expect(result).toBe(JSON.stringify({ temp: 21 }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const toolCallUrl = global.fetch.mock.calls[1][0];
    expect(toolCallUrl).toBe('https://api.example.com/weather?city=Paris');
  });

  it('skips (never throws for) an unreachable source', async () => {
    global.fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const tools = await resolveRcpSourceTools(
      agentWithSources([{ name: 'Down', isEnabled: true, url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );
    expect(tools).toEqual([]);
  });

  it('skips (never throws for) a manifest that fails schema validation', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ tools: [{ name: 'bad' }] }));
    const tools = await resolveRcpSourceTools(
      agentWithSources([{ name: 'Down', isEnabled: true, url: 'https://x.example.com/manifest' }]),
      'u1',
      context
    );
    expect(tools).toEqual([]);
  });

  it('continues to other sources after one fails', async () => {
    global.fetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(
        manifestOk([{ name: 'ping', description: 'Ping', method: 'GET', url: 'https://y.example.com/ping' }])
      );

    const tools = await resolveRcpSourceTools(
      agentWithSources([
        { name: 'Down', isEnabled: true, url: 'https://x.example.com/manifest' },
        { name: 'Up', isEnabled: true, url: 'https://y.example.com/manifest' },
      ]),
      'u1',
      context
    );

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('up__ping');
  });
});
