import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/mcp/mcp.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByOwner: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    count: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/mcp/mcp-user-connection.repository.js', () => ({
  default: {
    findByMcpAndUser: jest.fn(),
    upsert: jest.fn(),
    deleteByMcpAndUser: jest.fn(),
    deleteByMcp: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: {
    findAgentsUsingMcp: jest.fn(),
    removeMcpFromAgents: jest.fn(),
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

jest.unstable_mockModule('../src/modules/mcp/mcp-token.service.js', () => ({
  default: {
    getOwnerAccessToken: jest.fn(),
    getUserAccessToken: jest.fn(),
    getApiKeyToken: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/mcp/oauth-state.js', () => ({
  signOAuthState: jest.fn(() => 'signed-state'),
  verifyOAuthState: jest.fn(),
}));

jest.unstable_mockModule('../src/modules/mcp/mcp-oauth-client.js', () => ({
  discoverOAuthEndpoints: jest.fn(),
  dynamicClientRegistration: jest.fn(),
  generatePkcePair: jest.fn(() => ({ codeVerifier: 'verifier', codeChallenge: 'challenge' })),
  buildAuthorizationUrl: jest.fn(() => 'https://authorize.example.com'),
  exchangeCodeForToken: jest.fn(),
}));

const mockGetTools = jest.fn();
const mockClose = jest.fn();
jest.unstable_mockModule('@langchain/mcp-adapters', () => ({
  MultiServerMCPClient: jest.fn().mockImplementation(() => ({
    getTools: mockGetTools,
    close: mockClose,
  })),
}));

const mcpRepository = (await import('../src/modules/mcp/mcp.repository.js')).default;
const mcpUserConnectionRepository = (
  await import('../src/modules/mcp/mcp-user-connection.repository.js')
).default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const encryption = (await import('../src/utils/encryption.js')).default;
const mcpTokenService = (await import('../src/modules/mcp/mcp-token.service.js')).default;
const { signOAuthState, verifyOAuthState } = await import('../src/modules/mcp/oauth-state.js');
const { discoverOAuthEndpoints, exchangeCodeForToken } =
  await import('../src/modules/mcp/mcp-oauth-client.js');
const mcpService = (await import('../src/modules/mcp/mcp.service.js')).default;

describe('Mcp Service', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  let mockMcp;

  beforeEach(() => {
    jest.clearAllMocks();
    encryption.encrypt.mockImplementation((v) => `enc:${v}`);
    encryption.decrypt.mockImplementation((v) => String(v).replace(/^enc:/, ''));
    // Deterministic baseline: several code paths call agentRepository.findAgentsUsingMcp to invalidate
    // caches; without this, tests only pass when an implementation leaks in
    // from an earlier test (clearAllMocks clears calls, not implementations).
    agentRepository.findAgentsUsingMcp.mockResolvedValue([]);
    agentRepository.removeMcpFromAgents.mockResolvedValue({});

    mockMcp = {
      _id: '507f1f77bcf86cd799439022',
      ownerId: mockUserId,
      name: 'My MCP',
      transport: 'http',
      url: 'https://example.com/mcp',
      authType: 'none',
      authMode: 'owner',
      oauth: {},
      toObject() {
        return { ...this, toObject: undefined };
      },
    };
  });

  describe('toSafeJson', () => {
    it('never leaks the encrypted API key', () => {
      const apiKeyMcp = {
        ...mockMcp,
        authType: 'apiKey',
        apiKeyEncrypted: 'enc:super-secret',
        toObject() {
          return { ...this, toObject: undefined, oauth: undefined };
        },
      };

      const safe = mcpService.toSafeJson(apiKeyMcp);

      expect(safe.apiKeyEncrypted).toBeUndefined();
      expect(safe.hasApiKey).toBe(true);
      expect(JSON.stringify(safe)).not.toContain('super-secret');
    });
  });

  describe('createMcp', () => {
    it('creates a none-auth MCP without discovery', async () => {
      mcpRepository.create.mockResolvedValue(mockMcp);

      await mcpService.createMcp(mockUserId, {
        name: 'My MCP',
        transport: 'http',
        url: 'https://example.com/mcp',
      });

      expect(discoverOAuthEndpoints).not.toHaveBeenCalled();
      expect(mcpRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: mockUserId, authType: 'none' })
      );
    });

    it('discovers endpoints and encrypts the client secret for oauth MCPs', async () => {
      discoverOAuthEndpoints.mockResolvedValue({
        authorizationEndpoint: 'https://idp.example.com/authorize',
        tokenEndpoint: 'https://idp.example.com/token',
        scopesSupported: ['profile'],
      });
      mcpRepository.create.mockResolvedValue(mockMcp);

      await mcpService.createMcp(mockUserId, {
        name: 'My MCP',
        transport: 'sse',
        url: 'https://example.com/mcp',
        authType: 'oauth',
        authMode: 'user',
        oauth: { clientId: 'client1', clientSecret: 'secret1' },
      });

      expect(discoverOAuthEndpoints).toHaveBeenCalledWith('https://example.com/mcp');
      expect(encryption.encrypt).toHaveBeenCalledWith('secret1');
      expect(mcpRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authType: 'oauth',
          oauth: expect.objectContaining({
            clientId: 'client1',
            clientSecretEncrypted: 'enc:secret1',
            authorizationEndpoint: 'https://idp.example.com/authorize',
            tokenEndpoint: 'https://idp.example.com/token',
          }),
        })
      );
    });

    it('encrypts and stores a static API key for apiKey MCPs', async () => {
      mcpRepository.create.mockResolvedValue(mockMcp);

      await mcpService.createMcp(mockUserId, {
        name: 'Excalidraw',
        transport: 'http',
        url: 'https://api.excalidraw.com/api/v1/mcp',
        authType: 'apiKey',
        apiKey: 'secret-key-1',
      });

      expect(discoverOAuthEndpoints).not.toHaveBeenCalled();
      expect(encryption.encrypt).toHaveBeenCalledWith('secret-key-1');
      expect(mcpRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ authType: 'apiKey', apiKeyEncrypted: 'enc:secret-key-1' })
      );
    });

    it('rejects an apiKey MCP with no key provided', async () => {
      await expect(
        mcpService.createMcp(mockUserId, {
          name: 'Excalidraw',
          transport: 'http',
          url: 'https://api.excalidraw.com/api/v1/mcp',
          authType: 'apiKey',
        })
      ).rejects.toThrow('API key is required when auth type is apiKey');
    });
  });

  describe('getMcpById', () => {
    it('throws NotFoundError if owned by someone else', async () => {
      mcpRepository.findById.mockResolvedValue({ ...mockMcp, ownerId: 'someone-else' });

      await expect(mcpService.getMcpById(mockMcp._id, mockUserId)).rejects.toThrow(
        'MCP server not found'
      );
    });

    it('returns the doc if owned by the requester', async () => {
      mcpRepository.findById.mockResolvedValue(mockMcp);

      const result = await mcpService.getMcpById(mockMcp._id, mockUserId);
      expect(result).toEqual(mockMcp);
    });
  });

  describe('updateMcp', () => {
    it('throws ValidationError if switching to oauth without credentials', async () => {
      mcpRepository.findById.mockResolvedValue(mockMcp);

      await expect(
        mcpService.updateMcp(mockMcp._id, mockUserId, { authType: 'oauth' })
      ).rejects.toThrow('Client ID is required when auth type is oauth');
    });

    it('throws ValidationError if switching to apiKey without a key', async () => {
      mcpRepository.findById.mockResolvedValue(mockMcp);

      await expect(
        mcpService.updateMcp(mockMcp._id, mockUserId, { authType: 'apiKey' })
      ).rejects.toThrow('API key is required when auth type is apiKey');
    });

    it('encrypts a new API key when switching to apiKey', async () => {
      mcpRepository.findById.mockResolvedValue(mockMcp);
      mcpRepository.update.mockResolvedValue({ ...mockMcp, authType: 'apiKey' });
      agentRepository.findAgentsUsingMcp.mockResolvedValue([]);

      await mcpService.updateMcp(mockMcp._id, mockUserId, {
        authType: 'apiKey',
        apiKey: 'new-key',
      });

      expect(mcpRepository.update).toHaveBeenCalledWith(
        mockMcp._id,
        { ownerId: mockUserId },
        expect.objectContaining({ apiKeyEncrypted: 'enc:new-key' })
      );
      const [, , updateArg] = mcpRepository.update.mock.calls[0];
      expect(updateArg.apiKey).toBeUndefined();
    });

    it('keeps the existing API key when none is provided in the update', async () => {
      const apiKeyMcp = { ...mockMcp, authType: 'apiKey', apiKeyEncrypted: 'enc:existing-key' };
      mcpRepository.findById.mockResolvedValue(apiKeyMcp);
      mcpRepository.update.mockResolvedValue(apiKeyMcp);
      agentRepository.findAgentsUsingMcp.mockResolvedValue([]);

      await mcpService.updateMcp(mockMcp._id, mockUserId, { description: 'updated desc' });

      const [, , updateArg] = mcpRepository.update.mock.calls[0];
      expect(updateArg.apiKeyEncrypted).toBeUndefined();
    });

    it('invalidates dependent agents after a successful update', async () => {
      mcpRepository.findById.mockResolvedValue(mockMcp);
      mcpRepository.update.mockResolvedValue({ ...mockMcp, name: 'Renamed' });
      agentRepository.findAgentsUsingMcp.mockResolvedValue([{ _id: 'agent1' }]);

      await mcpService.updateMcp(mockMcp._id, mockUserId, { name: 'Renamed' });

      expect(agentFactory.invalidate).toHaveBeenCalledWith('agent1');
    });
  });

  describe('deleteMcp', () => {
    it('pulls the mcp from agents, deletes user connections, and invalidates caches', async () => {
      mcpRepository.findById.mockResolvedValue(mockMcp);
      agentRepository.findAgentsUsingMcp.mockResolvedValue([{ _id: 'agent1' }, { _id: 'agent2' }]);
      mcpRepository.delete.mockResolvedValue(mockMcp);

      await mcpService.deleteMcp(mockMcp._id, mockUserId);

      expect(agentRepository.removeMcpFromAgents).toHaveBeenCalledWith(mockMcp._id);
      expect(mcpUserConnectionRepository.deleteByMcp).toHaveBeenCalledWith(mockMcp._id);
      expect(agentFactory.invalidate).toHaveBeenCalledWith('agent1');
      expect(agentFactory.invalidate).toHaveBeenCalledWith('agent2');
      expect(mcpRepository.delete).toHaveBeenCalledWith(mockMcp._id, { ownerId: mockUserId });
    });
  });

  describe('getOwnerAuthorizationUrl', () => {
    it('throws if the MCP does not use oauth', async () => {
      mcpRepository.findById.mockResolvedValue(mockMcp);

      await expect(mcpService.getOwnerAuthorizationUrl(mockMcp._id, mockUserId)).rejects.toThrow(
        'This MCP server does not use OAuth'
      );
    });

    it('signs state and builds an authorization URL for oauth MCPs', async () => {
      const oauthMcp = {
        ...mockMcp,
        authType: 'oauth',
        oauth: {
          clientId: 'client1',
          authorizationEndpoint: 'https://idp.example.com/authorize',
          scopes: ['profile'],
        },
      };
      mcpRepository.findById.mockResolvedValue(oauthMcp);

      const url = await mcpService.getOwnerAuthorizationUrl(mockMcp._id, mockUserId);

      expect(signOAuthState).toHaveBeenCalledWith(
        expect.objectContaining({ mcpId: String(mockMcp._id), mode: 'owner' })
      );
      expect(url).toBe('https://authorize.example.com');
    });
  });

  describe('handleOwnerCallback', () => {
    it('rejects state for the wrong mode', async () => {
      verifyOAuthState.mockReturnValue({ mode: 'user', mcpId: String(mockMcp._id) });

      await expect(mcpService.handleOwnerCallback('code', 'state')).rejects.toThrow(
        'OAuth state does not match this request'
      );
    });

    it('exchanges the code, persists the owner token, and invalidates caches', async () => {
      const oauthMcp = {
        ...mockMcp,
        authType: 'oauth',
        oauth: {
          clientId: 'client1',
          clientSecretEncrypted: 'enc:secret1',
          tokenEndpoint: 'https://idp.example.com/token',
          toObject: () => ({ clientId: 'client1', tokenEndpoint: 'https://idp.example.com/token' }),
        },
      };
      mcpRepository.findById.mockResolvedValue(oauthMcp);
      verifyOAuthState.mockReturnValue({
        mode: 'owner',
        mcpId: String(mockMcp._id),
        principalType: 'PersonaUser',
        personaUserId: mockUserId,
        codeVerifier: 'verifier',
      });
      exchangeCodeForToken.mockResolvedValue({
        access_token: 'access1',
        refresh_token: 'refresh1',
        expires_in: 3600,
      });
      agentRepository.findAgentsUsingMcp.mockResolvedValue([]);

      const redirectTo = await mcpService.handleOwnerCallback('code', 'state');

      expect(mcpRepository.update).toHaveBeenCalledWith(
        mockMcp._id,
        { ownerId: mockUserId },
        expect.objectContaining({
          oauth: expect.objectContaining({
            ownerToken: expect.objectContaining({
              accessTokenEncrypted: 'enc:access1',
              refreshTokenEncrypted: 'enc:refresh1',
            }),
          }),
        })
      );
      expect(redirectTo).toContain(`mcpId=${mockMcp._id}`);
    });
  });

  describe('getUserConnectionStatus', () => {
    it('reports connected when a connection record exists', async () => {
      mcpUserConnectionRepository.findByMcpAndUser.mockResolvedValue({ _id: 'conn1' });

      const status = await mcpService.getUserConnectionStatus(mockMcp._id, mockUserId);

      expect(status).toEqual({ connected: true });
    });

    it('reports not connected when no connection record exists', async () => {
      mcpUserConnectionRepository.findByMcpAndUser.mockResolvedValue(null);

      const status = await mcpService.getUserConnectionStatus(mockMcp._id, mockUserId);

      expect(status).toEqual({ connected: false });
    });
  });

  describe('testConnection', () => {
    it('connects without auth headers for a none-auth MCP', async () => {
      mcpRepository.findById.mockResolvedValue(mockMcp);
      mockGetTools.mockResolvedValue([{ name: 'tool_a', description: 'does a thing' }]);
      mcpRepository.update.mockResolvedValue(mockMcp);

      const result = await mcpService.testConnection(mockMcp._id, mockUserId);

      expect(mcpTokenService.getOwnerAccessToken).not.toHaveBeenCalled();
      expect(result.tools).toEqual([{ name: 'tool_a', description: 'does a thing' }]);
      expect(result.resources).toEqual([]);
      expect(result.resourceTemplates).toEqual([]);
      expect(mcpRepository.update).toHaveBeenCalledWith(
        mockMcp._id,
        { ownerId: mockUserId },
        expect.objectContaining({
          tools: [{ name: 'tool_a', description: 'does a thing' }],
          resources: [],
          resourceTemplates: [],
        })
      );
    });

    it('includes a bearer token for an owner-mode oauth MCP', async () => {
      const oauthMcp = { ...mockMcp, authType: 'oauth', authMode: 'owner' };
      mcpRepository.findById.mockResolvedValue(oauthMcp);
      mcpTokenService.getOwnerAccessToken.mockResolvedValue('owner-access-token');
      mockGetTools.mockResolvedValue([]);
      mcpRepository.update.mockResolvedValue(oauthMcp);

      await mcpService.testConnection(mockMcp._id, mockUserId);

      expect(mcpTokenService.getOwnerAccessToken).toHaveBeenCalledWith(oauthMcp);
    });

    it('throws if an apiKey MCP has no key configured', async () => {
      const apiKeyMcp = { ...mockMcp, authType: 'apiKey', apiKeyEncrypted: null };
      mcpRepository.findById.mockResolvedValue(apiKeyMcp);
      mcpTokenService.getApiKeyToken.mockReturnValue(null);

      await expect(mcpService.testConnection(mockMcp._id, mockUserId)).rejects.toThrow(
        'This MCP server has no API key configured'
      );
    });
  });

  describe('callTool', () => {
    it('throws if an apiKey MCP has no key configured (auth resolved before connecting)', async () => {
      const apiKeyMcp = { ...mockMcp, authType: 'apiKey', apiKeyEncrypted: null };
      mcpRepository.findById.mockResolvedValue(apiKeyMcp);
      mcpTokenService.getApiKeyToken.mockReturnValue(null);

      await expect(mcpService.callTool(mockMcp._id, mockUserId, 'some-tool', {})).rejects.toThrow(
        'This MCP server has no API key configured'
      );
    });

    it('propagates a connection failure for an unreachable server', async () => {
      mcpRepository.findById.mockResolvedValue(mockMcp);

      await expect(mcpService.callTool(mockMcp._id, mockUserId, 'some-tool', {})).rejects.toThrow();
    });
  });

  describe('ownership generalization (blueprint Phase 9, PR-34)', () => {
    const projectContext = { domain: 'project-1', principalType: 'ProjectMachine' };
    const runtimeContext = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };

    describe('createMcp', () => {
      it('defaults to a PersonaUser-owned Mcp when no context is given', async () => {
        mcpRepository.create.mockResolvedValue(mockMcp);

        await mcpService.createMcp(mockUserId, {
          name: 'My MCP',
          transport: 'http',
          url: 'https://example.com/mcp',
        });

        expect(mcpRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ ownerType: 'PersonaUser', ownerId: mockUserId })
        );
      });

      it('creates a Project-owned Mcp for a ProjectMachineContext', async () => {
        mcpRepository.create.mockResolvedValue(mockMcp);

        await mcpService.createMcp(
          'irrelevant',
          { name: 'Support MCP', transport: 'http', url: 'https://example.com/mcp' },
          projectContext
        );

        expect(mcpRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ domain: 'project-1', ownerType: 'Project' })
        );
        const [createArg] = mcpRepository.create.mock.calls[0];
        expect(createArg.ownerId).toBeUndefined();
      });

      it('creates an ExternalUser-owned Mcp for a ProjectRuntimeContext', async () => {
        mcpRepository.create.mockResolvedValue(mockMcp);

        await mcpService.createMcp(
          'irrelevant',
          { name: 'My MCP', transport: 'http', url: 'https://example.com/mcp' },
          runtimeContext
        );

        expect(mcpRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            domain: 'project-1',
            ownerType: 'ExternalUser',
            externalOwnerId: 'sabik',
          })
        );
      });
    });

    describe('getMcpById', () => {
      it('recognizes the Project owner via ProjectMachineContext', async () => {
        const projectMcp = {
          ...mockMcp,
          ownerId: undefined,
          domain: 'project-1',
          ownerType: 'Project',
        };
        mcpRepository.findById.mockResolvedValue(projectMcp);

        await expect(
          mcpService.getMcpById(mockMcp._id, 'irrelevant', projectContext)
        ).resolves.toEqual(projectMcp);
      });

      it('recognizes the ExternalUser owner via ProjectRuntimeContext', async () => {
        const externalMcp = {
          ...mockMcp,
          ownerId: undefined,
          domain: 'project-1',
          ownerType: 'ExternalUser',
          externalOwnerId: 'sabik',
        };
        mcpRepository.findById.mockResolvedValue(externalMcp);

        await expect(
          mcpService.getMcpById(mockMcp._id, 'irrelevant', runtimeContext)
        ).resolves.toEqual(externalMcp);
      });

      it('rejects a different ExternalUser in the same Project', async () => {
        const externalMcp = {
          ...mockMcp,
          ownerId: undefined,
          domain: 'project-1',
          ownerType: 'ExternalUser',
          externalOwnerId: 'someone-else',
        };
        mcpRepository.findById.mockResolvedValue(externalMcp);

        await expect(
          mcpService.getMcpById(mockMcp._id, 'irrelevant', runtimeContext)
        ).rejects.toThrow('MCP server not found');
      });

      it('rejects a Project-owned Mcp from a different Domain', async () => {
        const otherProjectMcp = {
          ...mockMcp,
          ownerId: undefined,
          domain: 'project-2',
          ownerType: 'Project',
        };
        mcpRepository.findById.mockResolvedValue(otherProjectMcp);

        await expect(
          mcpService.getMcpById(mockMcp._id, 'irrelevant', projectContext)
        ).rejects.toThrow('MCP server not found');
      });
    });

    describe('updateMcp', () => {
      it('filters the repository update by the Project owner filter', async () => {
        const projectMcp = {
          ...mockMcp,
          ownerId: undefined,
          domain: 'project-1',
          ownerType: 'Project',
        };
        mcpRepository.findById.mockResolvedValue(projectMcp);
        mcpRepository.update.mockResolvedValue({ ...projectMcp, name: 'Renamed' });

        await mcpService.updateMcp(mockMcp._id, 'irrelevant', { name: 'Renamed' }, projectContext);

        expect(mcpRepository.update).toHaveBeenCalledWith(
          mockMcp._id,
          { domain: 'project-1', ownerType: 'Project' },
          expect.objectContaining({ name: 'Renamed' })
        );
      });
    });

    describe('deleteMcp', () => {
      it('filters the repository delete by the ExternalUser owner filter', async () => {
        const externalMcp = {
          ...mockMcp,
          ownerId: undefined,
          domain: 'project-1',
          ownerType: 'ExternalUser',
          externalOwnerId: 'sabik',
        };
        mcpRepository.findById.mockResolvedValue(externalMcp);
        mcpRepository.delete.mockResolvedValue(externalMcp);

        await mcpService.deleteMcp(mockMcp._id, 'irrelevant', runtimeContext);

        expect(mcpRepository.delete).toHaveBeenCalledWith(mockMcp._id, {
          domain: 'project-1',
          ownerType: 'ExternalUser',
          externalOwnerId: 'sabik',
        });
      });
    });
  });

  describe('discoverMcps / countDiscoverMcps (blueprint Phase 9, PR-46, AD-07 §19)', () => {
    const machineContext = { domain: 'project-1', principalType: 'ProjectMachine' };
    const runtimeContext = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };

    test('ProjectMachineContext scopes to the Domain only, every owner type', async () => {
      mcpRepository.search.mockResolvedValue([]);

      await mcpService.discoverMcps(machineContext, {}, { page: 1, limit: 20 });

      expect(mcpRepository.search).toHaveBeenCalledWith(
        { domain: 'project-1' },
        { page: 1, limit: 20 }
      );
    });

    test('ProjectRuntimeContext without scope=mine ALSO sees the whole Domain (no isPublic field exists)', async () => {
      mcpRepository.search.mockResolvedValue([]);

      await mcpService.discoverMcps(runtimeContext, {}, {});

      expect(mcpRepository.search).toHaveBeenCalledWith({ domain: 'project-1' }, {});
    });

    test("ProjectRuntimeContext with scope=mine restricts to that external user's own Mcps", async () => {
      mcpRepository.search.mockResolvedValue([]);

      await mcpService.discoverMcps(runtimeContext, { scope: 'mine' }, {});

      expect(mcpRepository.search).toHaveBeenCalledWith(
        { domain: 'project-1', ownerType: 'ExternalUser', externalOwnerId: 'sabik' },
        {}
      );
    });

    test('countDiscoverMcps uses the identical filter-building logic', async () => {
      mcpRepository.count.mockResolvedValue(4);

      const total = await mcpService.countDiscoverMcps(machineContext, {});

      expect(mcpRepository.count).toHaveBeenCalledWith({ domain: 'project-1' });
      expect(total).toBe(4);
    });
  });

  describe('OAuth/connection Subject generalization (blueprint Phase 9, PR-47c)', () => {
    const runtimeContext = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };

    test('getUserConnectionStatus builds an ExternalUser Subject filter, not a bare userId', async () => {
      mcpUserConnectionRepository.findByMcpAndUser.mockResolvedValue({ _id: 'conn1' });

      const status = await mcpService.getUserConnectionStatus(
        mockMcp._id,
        'irrelevant',
        runtimeContext
      );

      expect(mcpUserConnectionRepository.findByMcpAndUser).toHaveBeenCalledWith(mockMcp._id, {
        domain: 'project-1',
        externalUserId: 'sabik',
      });
      expect(status).toEqual({ connected: true });
    });

    test('disconnectUserConnection builds an ExternalUser Subject filter', async () => {
      await mcpService.disconnectUserConnection(mockMcp._id, 'irrelevant', runtimeContext);

      expect(mcpUserConnectionRepository.deleteByMcpAndUser).toHaveBeenCalledWith(mockMcp._id, {
        domain: 'project-1',
        externalUserId: 'sabik',
      });
    });

    test('getOwnerAuthorizationUrl signs state carrying the Project context, not a bare userId', async () => {
      const projectMcp = {
        ...mockMcp,
        ownerId: undefined,
        domain: 'project-1',
        ownerType: 'Project',
        authType: 'oauth',
        oauth: {
          authorizationEndpoint: 'https://idp.example.com/authorize',
          clientId: 'c1',
          scopes: [],
        },
      };
      mcpRepository.findById.mockResolvedValue(projectMcp);
      const machineContext = { domain: 'project-1', principalType: 'ProjectMachine' };

      await mcpService.getOwnerAuthorizationUrl(mockMcp._id, 'irrelevant', machineContext);

      expect(signOAuthState).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpId: String(mockMcp._id),
          mode: 'owner',
          domain: 'project-1',
          principalType: 'ProjectMachine',
        })
      );
    });

    test('getUserAuthorizationUrl rejects a cross-Domain Subject as not-found', async () => {
      const projectMcp = {
        ...mockMcp,
        domain: 'project-2',
        authType: 'oauth',
        authMode: 'user',
      };
      mcpRepository.findById.mockResolvedValue(projectMcp);

      await expect(
        mcpService.getUserAuthorizationUrl(mockMcp._id, 'irrelevant', undefined, runtimeContext)
      ).rejects.toThrow('MCP server not found');
    });
  });
});
