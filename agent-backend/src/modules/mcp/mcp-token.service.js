import mcpRepository from './mcp.repository.js';
import mcpUserConnectionRepository, {
  subjectFilterForContext,
} from './mcp-user-connection.repository.js';
import encryption from '../../utils/encryption.js';
import { refreshAccessToken } from './mcp-oauth-client.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

/**
 * Token resolution is split out from mcp.service.js so the runtime tool
 * loader (tools/mcp.tools.js) can depend on it without pulling in
 * agentFactory.js - which itself depends on tools/index.js - which would
 * otherwise create an import cycle back to here.
 */
class McpTokenService {
  /**
   * Whether a stored connection's credential can currently authenticate a
   * request — either the access token hasn't hard-expired yet, or there's a
   * refresh token to renew it with. This is a cheap DB-only check (compares
   * `expiresAt` against now); it does NOT verify the refresh token is still
   * accepted by the provider — that's only known once a refresh is actually
   * attempted (see `getUserAccessToken`/`getOwnerAccessToken`, which fail
   * closed — return `null` — if a refresh attempt itself fails).
   * `getUserConnectionStatus` uses this so a connection whose token is
   * already unrecoverable reads as disconnected instead of a stale `true`.
   */
  isTokenUsable(connection) {
    if (!connection?.accessTokenEncrypted) return false;
    if (connection.refreshTokenEncrypted) return true;
    const expiresAt = connection.expiresAt ? new Date(connection.expiresAt).getTime() : null;
    return !expiresAt || expiresAt > Date.now();
  }
  /**
   * Returns a ready-to-use bearer token for the MCP's owner-mode connection,
   * refreshing it first if it's near expiry. Returns null if not applicable
   * (authType !== 'oauth', authMode !== 'owner', or never connected).
   */
  async getOwnerAccessToken(mcp) {
    if (mcp.authType !== 'oauth' || mcp.authMode !== 'owner') return null;

    const ownerToken = mcp.oauth?.ownerToken;
    // Hard-expired with nothing to refresh — returning the stale token here
    // used to just defer the failure to whatever request tried to use it.
    if (!this.isTokenUsable(ownerToken)) return null;

    const expiresAt = ownerToken.expiresAt ? new Date(ownerToken.expiresAt).getTime() : 0;
    const isExpiring = expiresAt && expiresAt - Date.now() < TOKEN_REFRESH_SKEW_MS;

    if (!isExpiring || !ownerToken.refreshTokenEncrypted) {
      return encryption.decrypt(ownerToken.accessTokenEncrypted);
    }

    const clientSecret = mcp.oauth.clientSecretEncrypted
      ? encryption.decrypt(mcp.oauth.clientSecretEncrypted)
      : null;

    let refreshed;
    try {
      refreshed = await refreshAccessToken({
        tokenEndpoint: mcp.oauth.tokenEndpoint,
        clientId: mcp.oauth.clientId,
        clientSecret,
        refreshToken: encryption.decrypt(ownerToken.refreshTokenEncrypted),
        resource: mcp.url,
        tokenEndpointAuthMethod: mcp.oauth.tokenEndpointAuthMethod,
      });
    } catch (err) {
      // Refresh token itself was rejected (provider-side revocation, expiry,
      // etc.) — fail closed instead of throwing an unhandled error up
      // through whatever request triggered this token resolution.
      logger.error(`[MCP] owner token refresh failed for mcp ${mcp._id}: ${err?.message}`);
      return null;
    }

    const newExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null;

    await mcpRepository.update(
      mcp._id,
      { ownerId: mcp.ownerId },
      {
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
      }
    );

    return refreshed.access_token;
  }

  /**
   * Returns a ready-to-use bearer token for a specific end-user's own
   * connection to a user-mode MCP, refreshing it if near expiry. Returns
   * null if the user hasn't connected (caller should skip this MCP's tools).
   *
   * Developer Platform (blueprint Phase 9, PR-48): `context` closes the
   * Phase 7 gap flagged since PR-47c — this is the actual runtime
   * tool-execution call site (`agent.factory.js` -> `resolveAgentTools` ->
   * `resolveMcpTools` -> here), so an `ExternalUser` Subject's own
   * connection (stored by `domain` + `externalUserId`, not `userId`) now
   * resolves correctly instead of never matching. Defaults to a
   * Persona-shaped context built from `userId` — zero behavior change for
   * every existing caller that omits it.
   */
  async getUserAccessToken(
    mcp,
    userId,
    context = { principalType: 'PersonaUser', personaUserId: userId }
  ) {
    if (mcp.authType !== 'oauth' || mcp.authMode !== 'user') return null;

    const subjectFilter = subjectFilterForContext(context);
    const connection = await mcpUserConnectionRepository.findByMcpAndUser(mcp._id, subjectFilter);
    // Hard-expired with nothing to refresh — returning the stale token here
    // used to just defer the failure to whatever request tried to use it.
    if (!this.isTokenUsable(connection)) return null;

    const expiresAt = connection.expiresAt ? new Date(connection.expiresAt).getTime() : 0;
    const isExpiring = expiresAt && expiresAt - Date.now() < TOKEN_REFRESH_SKEW_MS;

    if (!isExpiring || !connection.refreshTokenEncrypted) {
      return encryption.decrypt(connection.accessTokenEncrypted);
    }

    const clientSecret = mcp.oauth.clientSecretEncrypted
      ? encryption.decrypt(mcp.oauth.clientSecretEncrypted)
      : null;

    let refreshed;
    try {
      refreshed = await refreshAccessToken({
        tokenEndpoint: mcp.oauth.tokenEndpoint,
        clientId: mcp.oauth.clientId,
        clientSecret,
        refreshToken: encryption.decrypt(connection.refreshTokenEncrypted),
        resource: mcp.url,
        tokenEndpointAuthMethod: mcp.oauth.tokenEndpointAuthMethod,
      });
    } catch (err) {
      // Refresh token itself was rejected (provider-side revocation, expiry,
      // etc.) — fail closed instead of throwing an unhandled error up
      // through whatever request triggered this token resolution (a live
      // chat run's tool resolution, or an MCP App widget's resource/tool
      // call — see mcp.tools.js and mcp.service.js#_resolveAuthHeaders).
      logger.error(
        `[MCP] user token refresh failed for mcp ${mcp._id}: ${err?.message}`
      );
      return null;
    }

    const newExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null;

    await mcpUserConnectionRepository.upsert(mcp._id, subjectFilter, {
      accessTokenEncrypted: encryption.encrypt(refreshed.access_token),
      refreshTokenEncrypted: refreshed.refresh_token
        ? encryption.encrypt(refreshed.refresh_token)
        : connection.refreshTokenEncrypted,
      expiresAt: newExpiresAt,
    });

    return refreshed.access_token;
  }

  /**
   * Returns the static bearer token for an apiKey-auth MCP. Returns null if
   * not applicable (authType !== 'apiKey' or never configured) - no refresh,
   * it's a fixed secret rather than an OAuth-issued token.
   */
  getApiKeyToken(mcp) {
    if (mcp.authType !== 'apiKey' || !mcp.apiKeyEncrypted) return null;
    return encryption.decrypt(mcp.apiKeyEncrypted);
  }
}

export default new McpTokenService();
