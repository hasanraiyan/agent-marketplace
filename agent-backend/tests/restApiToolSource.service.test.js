import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/restApiToolSources/restApiToolSource.repository.js', () => ({
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
    findAgentsUsingRestApiToolSource: jest.fn(),
    removeRestApiToolSourceFromAgents: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: {
    invalidate: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: {
    encrypt: jest.fn((v) => `enc:${v}`),
    decrypt: jest.fn((v) => String(v).replace(/^enc:/, '')),
  },
}));

const restApiToolSourceRepository = (
  await import('../src/modules/restApiToolSources/restApiToolSource.repository.js')
).default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const encryption = (await import('../src/utils/encryption.js')).default;
const ValidationError = (await import('../src/utils/errors/ValidationError.js')).default;
const NotFoundError = (await import('../src/utils/errors/NotFoundError.js')).default;
const restApiToolSourceService = (
  await import('../src/modules/restApiToolSources/restApiToolSource.service.js')
).default;

const context = { domain: 'proj-1', principalType: 'ProjectMachine' };

function ownedSource(overrides = {}) {
  return {
    _id: 'src-1',
    domain: 'proj-1',
    ownerType: 'Project',
    name: 'Coursify',
    url: 'https://coursify.dev/api/persona/rest-tools/manifest',
    authType: 'apiKey',
    apiKeyEncrypted: 'enc:secret123',
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe('restApiToolSourceService.createRestApiToolSource', () => {
  it('rejects apiKey auth with no key', async () => {
    await expect(
      restApiToolSourceService.createRestApiToolSource(
        undefined,
        { name: 'X', url: 'https://x.example.com', authType: 'apiKey' },
        context
      )
    ).rejects.toThrow(ValidationError);
    expect(restApiToolSourceRepository.create).not.toHaveBeenCalled();
  });

  it('encrypts the apiKey on create', async () => {
    restApiToolSourceRepository.create.mockResolvedValue({ _id: 's1' });
    await restApiToolSourceService.createRestApiToolSource(
      undefined,
      { name: 'X', url: 'https://x.example.com', authType: 'apiKey', apiKey: 'secret123' },
      context
    );
    expect(encryption.encrypt).toHaveBeenCalledWith('secret123');
    expect(restApiToolSourceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyEncrypted: 'enc:secret123' })
    );
  });
});

describe('restApiToolSourceService.testConnection', () => {
  it('fetches the manifest, stores a display-only summary, and stamps lastTestedAt', async () => {
    restApiToolSourceRepository.findById.mockResolvedValue(ownedSource());
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tools: [
          {
            name: 'Get profile',
            description: 'Fetch the learner profile',
            method: 'GET',
            url: 'https://x.example.com/me',
          },
        ],
      }),
    });
    restApiToolSourceRepository.update.mockResolvedValue({});

    const result = await restApiToolSourceService.testConnection('src-1', undefined, context);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://coursify.dev/api/persona/rest-tools/manifest',
      expect.objectContaining({ headers: { Authorization: 'Bearer secret123' } })
    );
    expect(restApiToolSourceRepository.update).toHaveBeenCalledWith(
      'src-1',
      expect.anything(),
      expect.objectContaining({
        tools: [
          {
            name: 'Get profile',
            description: 'Fetch the learner profile',
            method: 'GET',
            url: 'https://x.example.com/me',
          },
        ],
      })
    );
    expect(result.tools).toHaveLength(1);
  });

  it('throws ValidationError on a non-2xx response and never writes', async () => {
    restApiToolSourceRepository.findById.mockResolvedValue(ownedSource());
    global.fetch.mockResolvedValue({ ok: false, status: 503 });

    await expect(restApiToolSourceService.testConnection('src-1', undefined, context)).rejects.toThrow(
      ValidationError
    );
    expect(restApiToolSourceRepository.update).not.toHaveBeenCalled();
  });

  it('throws ValidationError on invalid JSON and never writes', async () => {
    restApiToolSourceRepository.findById.mockResolvedValue(ownedSource());
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(restApiToolSourceService.testConnection('src-1', undefined, context)).rejects.toThrow(
      ValidationError
    );
    expect(restApiToolSourceRepository.update).not.toHaveBeenCalled();
  });

  it('throws ValidationError when a manifest entry fails schema validation and never writes', async () => {
    restApiToolSourceRepository.findById.mockResolvedValue(ownedSource());
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tools: [{ name: 'Get profile' /* missing method/url */ }] }),
    });

    await expect(restApiToolSourceService.testConnection('src-1', undefined, context)).rejects.toThrow(
      ValidationError
    );
    expect(restApiToolSourceRepository.update).not.toHaveBeenCalled();
  });

  it("404s for a source outside the caller's domain", async () => {
    restApiToolSourceRepository.findById.mockResolvedValue(ownedSource({ domain: 'other-proj' }));
    await expect(restApiToolSourceService.testConnection('src-1', undefined, context)).rejects.toThrow(
      NotFoundError
    );
  });
});

describe('restApiToolSourceService.deleteRestApiToolSource', () => {
  it('detaches from every Agent using it, invalidates their cache, then deletes the source', async () => {
    restApiToolSourceRepository.findById.mockResolvedValue(ownedSource());
    agentRepository.findAgentsUsingRestApiToolSource.mockResolvedValue([{ _id: 'a1' }, { _id: 'a2' }]);
    restApiToolSourceRepository.delete.mockResolvedValue({});

    await restApiToolSourceService.deleteRestApiToolSource('src-1', undefined, context);

    expect(agentRepository.removeRestApiToolSourceFromAgents).toHaveBeenCalledWith('src-1');
    expect(agentFactory.invalidate).toHaveBeenCalledTimes(2);
    expect(restApiToolSourceRepository.delete).toHaveBeenCalled();
  });
});

describe('restApiToolSourceService.getRestApiToolSourceUsage', () => {
  it('returns the agent count and a capped preview', async () => {
    restApiToolSourceRepository.findById.mockResolvedValue(ownedSource());
    agentRepository.count.mockResolvedValue(3);
    agentRepository.findAgentsUsingRestApiToolSource.mockResolvedValue([{ _id: 'a1', name: 'Agent 1' }]);

    const usage = await restApiToolSourceService.getRestApiToolSourceUsage('src-1', undefined, context);

    expect(agentRepository.count).toHaveBeenCalledWith({ restApiToolSources: 'src-1' });
    expect(usage).toEqual({ agentCount: 3, agents: [{ _id: 'a1', name: 'Agent 1' }] });
  });
});
