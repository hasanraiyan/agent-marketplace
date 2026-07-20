import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/mcp/mcp.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByOwner: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
        mockUserId,
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
      expect(mcpRepository.delete).toHaveBeenCalledWith(mockMcp._id, mockUserId);
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
        userId: mockUserId,
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
        mockUserId,
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
        mockUserId,
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
});
