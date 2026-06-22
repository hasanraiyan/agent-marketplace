import mcpRepository from '../repositories/mcpRepository.js';
import mcpUserConnectionRepository from '../repositories/mcpUserConnectionRepository.js';
import encryption from '../utils/encryption.js';
import { refreshAccessToken } from '../utils/mcpOAuthClient.js';

const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

/**
 * Token resolution is split out from mcp.service.js so the runtime tool
 * loader (tools/mcp.tools.js) can depend on it without pulling in
 * agentFactory.js - which itself depends on tools/index.js - which would
 * otherwise create an import cycle back to here.
 */
class McpTokenService {
  /**
   * Returns a ready-to-use bearer token for the MCP's owner-mode connection,
   * refreshing it first if it's near expiry. Returns null if not applicable
   * (authType !== 'oauth', authMode !== 'owner', or never connected).
   */
  async getOwnerAccessToken(mcp) {
    if (mcp.authType !== 'oauth' || mcp.authMode !== 'owner') return null;

    const ownerToken = mcp.oauth?.ownerToken;
    if (!ownerToken?.accessTokenEncrypted) return null;

    const expiresAt = ownerToken.expiresAt ? new Date(ownerToken.expiresAt).getTime() : 0;
    const isExpiring = expiresAt && expiresAt - Date.now() < TOKEN_REFRESH_SKEW_MS;

    if (!isExpiring || !ownerToken.refreshTokenEncrypted) {
      return encryption.decrypt(ownerToken.accessTokenEncrypted);
    }

    const clientSecret = mcp.oauth.clientSecretEncrypted
      ? encryption.decrypt(mcp.oauth.clientSecretEncrypted)
      : null;

    const refreshed = await refreshAccessToken({
      tokenEndpoint: mcp.oauth.tokenEndpoint,
      clientId: mcp.oauth.clientId,
      clientSecret,
      refreshToken: encryption.decrypt(ownerToken.refreshTokenEncrypted),
    });

    const newExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null;

    await mcpRepository.update(mcp._id, mcp.ownerId, {
      oauth: {
        ...(mcp.oauth.toObject?.() || mcp.oauth),
        ownerToken: {
          accessTokenEncrypted: encryption.encrypt(refreshed.access_token),
          refreshTokenEncrypted: refreshed.refresh_token
            ? encryption.encrypt(refreshed.refresh_token)
            : ownerToken.refreshTokenEncrypted,
          expiresAt: newExpiresAt,
        },
      },
    });

    return refreshed.access_token;
  }

  /**
   * Returns a ready-to-use bearer token for a specific end-user's own
   * connection to a user-mode MCP, refreshing it if near expiry. Returns
   * null if the user hasn't connected (caller should skip this MCP's tools).
   */
  async getUserAccessToken(mcp, userId) {
    if (mcp.authType !== 'oauth' || mcp.authMode !== 'user') return null;

    const connection = await mcpUserConnectionRepository.findByMcpAndUser(mcp._id, userId);
    if (!connection) return null;

    const expiresAt = connection.expiresAt ? new Date(connection.expiresAt).getTime() : 0;
    const isExpiring = expiresAt && expiresAt - Date.now() < TOKEN_REFRESH_SKEW_MS;

    if (!isExpiring || !connection.refreshTokenEncrypted) {
      return encryption.decrypt(connection.accessTokenEncrypted);
    }

    const clientSecret = mcp.oauth.clientSecretEncrypted
      ? encryption.decrypt(mcp.oauth.clientSecretEncrypted)
      : null;

    const refreshed = await refreshAccessToken({
      tokenEndpoint: mcp.oauth.tokenEndpoint,
      clientId: mcp.oauth.clientId,
      clientSecret,
      refreshToken: encryption.decrypt(connection.refreshTokenEncrypted),
    });

    const newExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null;

    await mcpUserConnectionRepository.upsert(mcp._id, userId, {
      accessTokenEncrypted: encryption.encrypt(refreshed.access_token),
      refreshTokenEncrypted: refreshed.refresh_token
        ? encryption.encrypt(refreshed.refresh_token)
        : connection.refreshTokenEncrypted,
      expiresAt: newExpiresAt,
    });

    return refreshed.access_token;
  }
}

export default new McpTokenService();
