import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/rcpSources/rcpSource.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    count: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: {
    count: jest.fn(),
    findAgentsUsingRcpSource: jest.fn(),
    removeRcpSourceFromAgents: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: {
    invalidate: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectSecret.service.js', () => ({
  default: {
    getSecretById: jest.fn(),
    resolvePlaintext: jest.fn(),
  },
}));

const rcpSourceRepository = (await import('../src/modules/rcpSources/rcpSource.repository.js'))
  .default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const projectSecretService = (await import('../src/modules/projects/projectSecret.service.js'))
  .default;
const ValidationError = (await import('../src/utils/errors/ValidationError.js')).default;
const NotFoundError = (await import('../src/utils/errors/NotFoundError.js')).default;
const rcpSourceService = (await import('../src/modules/rcpSources/rcpSource.service.js')).default;

const context = { domain: 'proj-1', principalType: 'ProjectMachine' };

function ownedSource(overrides = {}) {
  return {
    _id: 'src-1',
    domain: 'proj-1',
    ownerType: 'Project',
    name: 'Weather Co',
    url: 'https://weatherco.dev/rcp/manifest',
    authType: 'header',
    secretRef: 'secret-1',
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  projectSecretService.resolvePlaintext.mockResolvedValue('secret123');
});

describe('rcpSourceService.createRcpSource', () => {
  it('rejects header auth with no secret', async () => {
    await expect(
      rcpSourceService.createRcpSource(
        undefined,
        { name: 'X', url: 'https://x.example.com', authType: 'header' },
        context
      )
    ).rejects.toThrow(ValidationError);
    expect(rcpSourceRepository.create).not.toHaveBeenCalled();
  });

  it('validates the secret is in-domain and stores its ref on create', async () => {
    projectSecretService.getSecretById.mockResolvedValue({ _id: 'secret-1' });
    rcpSourceRepository.create.mockResolvedValue({ _id: 's1' });
    await rcpSourceService.createRcpSource(
      undefined,
      { name: 'X', url: 'https://x.example.com', authType: 'header', secretRef: 'secret-1' },
      context
    );
    expect(projectSecretService.getSecretById).toHaveBeenCalledWith(context, 'secret-1');
    expect(rcpSourceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ secretRef: 'secret-1' })
    );
  });
});

describe('rcpSourceService.testConnection', () => {
  it('discovers the manifest via rcp-sdk, stores a display-only summary, and stamps lastTestedAt', async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource());
    global.fetch.mockResolvedValue(
      jsonResponse({
        rcpVersion: '0.1',
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather',
            method: 'GET',
            url: 'https://x.example.com/weather',
          },
        ],
      })
    );
    rcpSourceRepository.update.mockResolvedValue({});

    const result = await rcpSourceService.testConnection('src-1', undefined, context);

    expect(projectSecretService.resolvePlaintext).toHaveBeenCalledWith('secret-1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://weatherco.dev/rcp/manifest',
      expect.objectContaining({ headers: { Authorization: 'Bearer secret123' } })
    );
    expect(rcpSourceRepository.update).toHaveBeenCalledWith(
      'src-1',
      expect.anything(),
      expect.objectContaining({
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather',
            method: 'GET',
            url: 'https://x.example.com/weather',
            params: [],
          },
        ],
      })
    );
    expect(result.tools).toHaveLength(1);
  });

  it("summarizes each tool's full (unfiltered) param list, since testConnection registers no resolvers", async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource());
    global.fetch.mockResolvedValue(
      jsonResponse({
        rcpVersion: '0.1',
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather',
            method: 'GET',
            url: 'https://x.example.com/weather',
            params: [
              { name: 'city', type: 'string', required: true, description: 'City name' },
              { name: 'units', type: 'string', required: false },
            ],
          },
        ],
      })
    );
    rcpSourceRepository.update.mockResolvedValue({});

    await rcpSourceService.testConnection('src-1', undefined, context);

    expect(rcpSourceRepository.update).toHaveBeenCalledWith(
      'src-1',
      expect.anything(),
      expect.objectContaining({
        tools: [
          expect.objectContaining({
            params: [
              { name: 'city', type: 'string', required: true, description: 'City name' },
              { name: 'units', type: 'string', required: false, description: '' },
            ],
          }),
        ],
      })
    );
  });

  it('throws ValidationError on a non-2xx response and never writes', async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource());
    global.fetch.mockResolvedValue(jsonResponse({}, 503));

    await expect(rcpSourceService.testConnection('src-1', undefined, context)).rejects.toThrow(
      ValidationError
    );
    expect(rcpSourceRepository.update).not.toHaveBeenCalled();
  });

  it('throws ValidationError when the manifest fails schema validation and never writes', async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource());
    global.fetch.mockResolvedValue(jsonResponse({ tools: [{ name: 'bad' }] }));

    await expect(rcpSourceService.testConnection('src-1', undefined, context)).rejects.toThrow(
      ValidationError
    );
    expect(rcpSourceRepository.update).not.toHaveBeenCalled();
  });

  it('throws ValidationError on an unsupported rcpVersion and never writes', async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource());
    global.fetch.mockResolvedValue(jsonResponse({ rcpVersion: '99.0', tools: [] }));

    await expect(rcpSourceService.testConnection('src-1', undefined, context)).rejects.toThrow(
      ValidationError
    );
    expect(rcpSourceRepository.update).not.toHaveBeenCalled();
  });

  it("404s for a source outside the caller's domain", async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource({ domain: 'other-proj' }));
    await expect(rcpSourceService.testConnection('src-1', undefined, context)).rejects.toThrow(
      NotFoundError
    );
  });
});

describe('rcpSourceService.deleteRcpSource', () => {
  it('detaches from every Agent using it, invalidates their cache, then deletes the source', async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource());
    agentRepository.findAgentsUsingRcpSource.mockResolvedValue([{ _id: 'a1' }, { _id: 'a2' }]);
    rcpSourceRepository.delete.mockResolvedValue({});

    await rcpSourceService.deleteRcpSource('src-1', undefined, context);

    expect(agentRepository.removeRcpSourceFromAgents).toHaveBeenCalledWith('src-1');
    expect(agentFactory.invalidate).toHaveBeenCalledTimes(2);
    expect(rcpSourceRepository.delete).toHaveBeenCalled();
  });
});

describe('rcpSourceService.getRcpSourceUsage', () => {
  it('returns the agent count and a capped preview', async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource());
    agentRepository.count.mockResolvedValue(2);
    agentRepository.findAgentsUsingRcpSource.mockResolvedValue([{ _id: 'a1', name: 'Agent 1' }]);

    const usage = await rcpSourceService.getRcpSourceUsage('src-1', undefined, context);

    expect(agentRepository.count).toHaveBeenCalledWith({ rcpSources: 'src-1' });
    expect(usage).toEqual({ agentCount: 2, agents: [{ _id: 'a1', name: 'Agent 1' }] });
  });
});

// Regression coverage for a real bug: _buildDiscoveryFilter used to be
// `scopedFilter(context?.domain, extra)` with no ownerType/scope branching
// at all — any caller in the Domain, including any other external user,
// could list every source, Project- and ExternalUser-owned alike. Now
// routed through the shared buildDiscoveryFilter (resourceOwnership.js).
describe('rcpSourceService._buildDiscoveryFilter (via discoverRcpSources)', () => {
  const externalUserContext = (externalUserId) => ({
    domain: 'proj-1',
    principalType: 'ProjectRuntime',
    externalUserId,
  });

  beforeEach(() => {
    rcpSourceRepository.search.mockResolvedValue([]);
  });

  it('a ProjectMachine/admin context sees every source in the Domain, any owner', async () => {
    await rcpSourceService.discoverRcpSources(context, {}, { page: 1, limit: 20 });

    expect(rcpSourceRepository.search).toHaveBeenCalledWith(
      { domain: 'proj-1' },
      { page: 1, limit: 20 }
    );
  });

  it('a ProjectRuntime context with scope: "mine" sees only that external user\'s own sources', async () => {
    await rcpSourceService.discoverRcpSources(
      externalUserContext('user-42'),
      { scope: 'mine' },
      { page: 1, limit: 20 }
    );

    expect(rcpSourceRepository.search).toHaveBeenCalledWith(
      { domain: 'proj-1', ownerType: 'ExternalUser', externalOwnerId: 'user-42' },
      { page: 1, limit: 20 }
    );
  });

  it("a ProjectRuntime context with no scope sees only Project-owned sources — never another external user's private ones", async () => {
    await rcpSourceService.discoverRcpSources(
      externalUserContext('user-42'),
      {},
      { page: 1, limit: 20 }
    );

    expect(rcpSourceRepository.search).toHaveBeenCalledWith(
      { domain: 'proj-1', ownerType: 'Project' },
      { page: 1, limit: 20 }
    );
  });
});

describe('rcpSourceService.getRcpSourceById (strict ownership)', () => {
  it('throws for a ProjectRuntime caller on a Project-owned (shared) source — this method is owner-only', async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource({ ownerType: 'Project' }));

    await expect(
      rcpSourceService.getRcpSourceById('src-1', undefined, {
        domain: 'proj-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'user-42',
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("throws for a different external user's own source", async () => {
    rcpSourceRepository.findById.mockResolvedValue(
      ownedSource({ ownerType: 'ExternalUser', externalOwnerId: 'user-1' })
    );

    await expect(
      rcpSourceService.getRcpSourceById('src-1', undefined, {
        domain: 'proj-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'user-2',
      })
    ).rejects.toThrow(NotFoundError);
  });
});

describe('rcpSourceService.getReadableRcpSourceById (display-only, admits shared sources)', () => {
  it('a ProjectRuntime caller CAN read a Project-owned (shared) source', async () => {
    rcpSourceRepository.findById.mockResolvedValue(ownedSource({ ownerType: 'Project' }));

    const source = await rcpSourceService.getReadableRcpSourceById('src-1', undefined, {
      domain: 'proj-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'user-42',
    });

    expect(source.ownerType).toBe('Project');
  });

  it("still throws for a different external user's own private source", async () => {
    rcpSourceRepository.findById.mockResolvedValue(
      ownedSource({ ownerType: 'ExternalUser', externalOwnerId: 'user-1' })
    );

    await expect(
      rcpSourceService.getReadableRcpSourceById('src-1', undefined, {
        domain: 'proj-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'user-2',
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("still throws for a different Domain's Project-owned source", async () => {
    rcpSourceRepository.findById.mockResolvedValue(
      ownedSource({ ownerType: 'Project', domain: 'other-proj' })
    );

    await expect(
      rcpSourceService.getReadableRcpSourceById('src-1', undefined, {
        domain: 'proj-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'user-42',
      })
    ).rejects.toThrow(NotFoundError);
  });
});
