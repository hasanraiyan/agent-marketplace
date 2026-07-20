import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/mcp/mcp.repository.js', () => ({
  default: {
    update: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/mcp/mcp-user-connection.repository.js', () => ({
  default: {
    findByMcpAndUser: jest.fn(),
    upsert: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: {
    encrypt: jest.fn((v) => `enc:${v}`),
    decrypt: jest.fn((v) => v.replace(/^enc:/, '')),
  },
}));

jest.unstable_mockModule('../src/modules/mcp/mcp-oauth-client.js', () => ({
  refreshAccessToken: jest.fn(),
}));

const mcpRepository = (await import('../src/modules/mcp/mcp.repository.js')).default;
const mcpUserConnectionRepository = (
  await import('../src/modules/mcp/mcp-user-connection.repository.js')
).default;
const encryption = (await import('../src/utils/encryption.js')).default;
const { refreshAccessToken } = await import('../src/modules/mcp/mcp-oauth-client.js');
const mcpTokenService = (await import('../src/modules/mcp/mcp-token.service.js')).default;

describe('McpToken Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    encryption.encrypt.mockImplementation((v) => `enc:${v}`);
    encryption.decrypt.mockImplementation((v) => v.replace(/^enc:/, ''));
  });

  describe('getOwnerAccessToken', () => {
    it('returns null when authType is not oauth', async () => {
      const result = await mcpTokenService.getOwnerAccessToken({ authType: 'none' });
      expect(result).toBeNull();
    });

    it('returns null when authMode is not owner', async () => {
      const result = await mcpTokenService.getOwnerAccessToken({
        authType: 'oauth',
        authMode: 'user',
      });
      expect(result).toBeNull();
    });

    it('returns null when never connected', async () => {
      const result = await mcpTokenService.getOwnerAccessToken({
        authType: 'oauth',
        authMode: 'owner',
        oauth: { ownerToken: {} },
      });
      expect(result).toBeNull();
    });

    it('returns the decrypted token when not near expiry', async () => {
      const mcp = {
        authType: 'oauth',
        authMode: 'owner',
        oauth: {
          ownerToken: {
            accessTokenEncrypted: 'enc:access-1',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        },
      };

      const token = await mcpTokenService.getOwnerAccessToken(mcp);

      expect(token).toBe('access-1');
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it('refreshes and persists when near expiry', async () => {
      const mcp = {
        _id: 'mcp1',
        ownerId: 'owner1',
        authType: 'oauth',
        authMode: 'owner',
        oauth: {
          clientId: 'client1',
          clientSecretEncrypted: 'enc:secret1',
          tokenEndpoint: 'https://example.com/token',
          toObject: () => ({
            clientId: 'client1',
            clientSecretEncrypted: 'enc:secret1',
            tokenEndpoint: 'https://example.com/token',
          }),
          ownerToken: {
            accessTokenEncrypted: 'enc:old-access',
            refreshTokenEncrypted: 'enc:old-refresh',
            expiresAt: new Date(Date.now() + 10 * 1000), // within skew window
          },
        },
      };

      refreshAccessToken.mockResolvedValue({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });

      const token = await mcpTokenService.getOwnerAccessToken(mcp);

      expect(refreshAccessToken).toHaveBeenCalledWith({
        tokenEndpoint: 'https://example.com/token',
        clientId: 'client1',
        clientSecret: 'secret1',
        refreshToken: 'old-refresh',
      });
      expect(mcpRepository.update).toHaveBeenCalled();
      expect(token).toBe('new-access');
    });
  });

  describe('getUserAccessToken', () => {
    it('returns null when no connection exists', async () => {
      mcpUserConnectionRepository.findByMcpAndUser.mockResolvedValue(null);

      const result = await mcpTokenService.getUserAccessToken(
        { authType: 'oauth', authMode: 'user' },
        'user1'
      );

      expect(result).toBeNull();
    });

    it('returns the decrypted token when not near expiry', async () => {
      mcpUserConnectionRepository.findByMcpAndUser.mockResolvedValue({
        accessTokenEncrypted: 'enc:user-access',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const result = await mcpTokenService.getUserAccessToken(
        { _id: 'mcp1', authType: 'oauth', authMode: 'user' },
        'user1'
      );

      expect(result).toBe('user-access');
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it('refreshes and persists when near expiry', async () => {
      mcpUserConnectionRepository.findByMcpAndUser.mockResolvedValue({
        accessTokenEncrypted: 'enc:old-user-access',
        refreshTokenEncrypted: 'enc:old-user-refresh',
        expiresAt: new Date(Date.now() + 5 * 1000),
      });

      refreshAccessToken.mockResolvedValue({
        access_token: 'new-user-access',
        refresh_token: 'new-user-refresh',
        expires_in: 3600,
      });

      const mcp = {
        _id: 'mcp1',
        authType: 'oauth',
        authMode: 'user',
        oauth: {
          clientId: 'client1',
          clientSecretEncrypted: 'enc:secret1',
          tokenEndpoint: 'https://example.com/token',
        },
      };

      const result = await mcpTokenService.getUserAccessToken(mcp, 'user1');

      expect(mcpUserConnectionRepository.upsert).toHaveBeenCalledWith(
        'mcp1',
        'user1',
        expect.objectContaining({ accessTokenEncrypted: 'enc:new-user-access' })
      );
      expect(result).toBe('new-user-access');
    });
  });
});
