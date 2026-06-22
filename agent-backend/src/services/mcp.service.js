import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import mcpRepository from '../repositories/mcpRepository.js';
import mcpUserConnectionRepository from '../repositories/mcpUserConnectionRepository.js';
import Agent from '../models/Agent.js';
import agentFactory from '../factories/agentFactory.js';
import encryption from '../utils/encryption.js';
import mcpTokenService from './mcpToken.service.js';
import { signOAuthState, verifyOAuthState } from '../utils/oauthState.js';
import {
  discoverOAuthEndpoints,
  generatePkcePair,
  buildAuthorizationUrl,
  exchangeCodeForToken,
} from '../utils/mcpOAuthClient.js';
import config from '../config/index.js';
import NotFoundError from '../utils/errors/NotFoundError.js';
import ValidationError from '../utils/errors/ValidationError.js';

// Fixed, mcpId-independent callback URLs - these are what gets registered in
// the external OAuth provider's "Redirect URIs" allowlist ahead of time, so
// they cannot depend on a specific Mcp's _id (which doesn't exist until
// after that Mcp is created). The actual mcpId travels inside the signed
// `state` param instead.
function redirectUriFor(mode) {
  return `${config.backendUrl}/api/v1/mcps/oauth/${mode}/callback`;
}

class McpService {
  /**
   * Strips encrypted/secret fields before a doc is sent to the client.
   */
  toSafeJson(mcp) {
    const obj = mcp.toObject ? mcp.toObject() : mcp;
    const { oauth, ...rest } = obj;

    if (!oauth) return rest;

    return {
      ...rest,
      oauth: {
        clientId: oauth.clientId || null,
        hasClientSecret: Boolean(oauth.clientSecretEncrypted),
        authorizationEndpoint: oauth.authorizationEndpoint || null,
        tokenEndpoint: oauth.tokenEndpoint || null,
        scopes: oauth.scopes || [],
        ownerConnected: Boolean(oauth.ownerToken?.accessTokenEncrypted),
      },
    };
  }

  async createMcp(userId, data) {
    const mcpData = {
      ownerId: userId,
      name: data.name,
      description: data.description || '',
      transport: data.transport,
      url: data.url,
      authType: data.authType || 'none',
      authMode: data.authMode || 'owner',
      isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
    };

    if (mcpData.authType === 'oauth') {
      const discovered = await discoverOAuthEndpoints(data.url);
      mcpData.oauth = {
        clientId: data.oauth.clientId,
        clientSecretEncrypted: encryption.encrypt(data.oauth.clientSecret),
        authorizationEndpoint: discovered.authorizationEndpoint,
        tokenEndpoint: discovered.tokenEndpoint,
        scopes: data.oauth.scopes?.length ? data.oauth.scopes : discovered.scopesSupported,
      };
    }

    return await mcpRepository.create(mcpData);
  }

  async getMyMcps(userId) {
    return await mcpRepository.findByOwner(userId);
  }

  async getMcpById(id, userId) {
    const mcp = await mcpRepository.findById(id);
    if (!mcp || mcp.ownerId.toString() !== userId.toString()) {
      throw new NotFoundError('MCP server not found');
    }
    return mcp;
  }

  async updateMcp(id, userId, data) {
    const existing = await this.getMcpById(id, userId);

    const updateData = { ...data };
    const resolvedAuthType = data.authType || existing.authType;

    if (resolvedAuthType === 'oauth') {
      const needsDiscovery = data.url || !existing.oauth?.authorizationEndpoint;
      const discovered = needsDiscovery
        ? await discoverOAuthEndpoints(data.url || existing.url)
        : null;

      const clientId = data.oauth?.clientId || existing.oauth?.clientId;
      const hasSecret = Boolean(data.oauth?.clientSecret || existing.oauth?.clientSecretEncrypted);

      if (!clientId || !hasSecret) {
        throw new ValidationError(
          'Client ID and Client Secret are required when auth type is oauth'
        );
      }

      updateData.oauth = {
        clientId,
        clientSecretEncrypted: data.oauth?.clientSecret
          ? encryption.encrypt(data.oauth.clientSecret)
          : existing.oauth.clientSecretEncrypted,
        authorizationEndpoint: discovered?.authorizationEndpoint || existing.oauth.authorizationEndpoint,
        tokenEndpoint: discovered?.tokenEndpoint || existing.oauth.tokenEndpoint,
        scopes: data.oauth?.scopes || existing.oauth?.scopes || [],
        ownerToken: existing.oauth?.ownerToken || {},
      };
    } else if (data.authType === 'none') {
      updateData.oauth = {};
    }

    const mcp = await mcpRepository.update(id, userId, updateData);
    await this._invalidateAgentsUsingMcp(id);
    return mcp;
  }

  async deleteMcp(id, userId) {
    const mcp = await this.getMcpById(id, userId);

    const agents = await Agent.find({ mcps: id }, '_id');
    await Agent.updateMany({ mcps: id }, { $pull: { mcps: id } });
    await mcpUserConnectionRepository.deleteByMcp(id);

    for (const agent of agents) {
      agentFactory.invalidate(agent._id);
    }

    return await mcpRepository.delete(id, userId);
  }

  async _invalidateAgentsUsingMcp(mcpId) {
    const agents = await Agent.find({ mcps: mcpId }, '_id');
    for (const agent of agents) {
      agentFactory.invalidate(agent._id);
    }
  }

  async testConnection(id, userId) {
    const mcp = await this.getMcpById(id, userId);

    const headers = {};
    if (mcp.authType === 'oauth') {
      const token =
        mcp.authMode === 'owner'
          ? await mcpTokenService.getOwnerAccessToken(mcp)
          : await mcpTokenService.getUserAccessToken(mcp, userId);
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const client = new MultiServerMCPClient({
      mcpServers: {
        [String(mcp._id)]: { transport: mcp.transport, url: mcp.url, headers },
      },
    });

    try {
      const tools = await client.getTools();
      const toolSummaries = tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
      }));

      await mcpRepository.update(id, userId, { tools: toolSummaries, lastTestedAt: new Date() });
      return toolSummaries;
    } finally {
      await client.close?.();
    }
  }

  async getOwnerAuthorizationUrl(id, userId) {
    const mcp = await this.getMcpById(id, userId);
    if (mcp.authType !== 'oauth') {
      throw new ValidationError('This MCP server does not use OAuth');
    }

    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = signOAuthState({ mcpId: String(id), userId: String(userId), mode: 'owner', codeVerifier });

    const url = buildAuthorizationUrl({
      authorizationEndpoint: mcp.oauth.authorizationEndpoint,
      clientId: mcp.oauth.clientId,
      redirectUri: redirectUriFor('owner'),
      codeChallenge,
      state,
      scopes: mcp.oauth.scopes,
    });

    return url;
  }

  async handleOwnerCallback(code, state) {
    const decoded = verifyOAuthState(state);
    if (decoded.mode !== 'owner') {
      throw new ValidationError('OAuth state does not match this request');
    }

    const id = decoded.mcpId;
    const mcp = await mcpRepository.findById(id);
    if (!mcp) throw new NotFoundError('MCP server not found');

    const tokenResponse = await exchangeCodeForToken({
      tokenEndpoint: mcp.oauth.tokenEndpoint,
      clientId: mcp.oauth.clientId,
      clientSecret: encryption.decrypt(mcp.oauth.clientSecretEncrypted),
      code,
      redirectUri: redirectUriFor('owner'),
      codeVerifier: decoded.codeVerifier,
    });

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    await mcpRepository.update(id, decoded.userId, {
      oauth: {
        ...mcp.oauth.toObject(),
        ownerToken: {
          accessTokenEncrypted: encryption.encrypt(tokenResponse.access_token),
          refreshTokenEncrypted: tokenResponse.refresh_token
            ? encryption.encrypt(tokenResponse.refresh_token)
            : null,
          expiresAt,
        },
      },
    });

    await this._invalidateAgentsUsingMcp(id);

    return `${config.websiteUrl.replace(/\/+$/, '')}/dashboard/connectors/mcps?mcpId=${id}&connected=owner`;
  }

  async getUserAuthorizationUrl(id, userId, returnTo) {
    const mcp = await mcpRepository.findById(id);
    if (!mcp) throw new NotFoundError('MCP server not found');
    if (mcp.authType !== 'oauth' || mcp.authMode !== 'user') {
      throw new ValidationError('This MCP server is not configured for per-user authentication');
    }

    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = signOAuthState({
      mcpId: String(id),
      userId: String(userId),
      mode: 'user',
      codeVerifier,
      returnTo: returnTo || config.websiteUrl,
    });

    return buildAuthorizationUrl({
      authorizationEndpoint: mcp.oauth.authorizationEndpoint,
      clientId: mcp.oauth.clientId,
      redirectUri: redirectUriFor('user'),
      codeChallenge,
      state,
      scopes: mcp.oauth.scopes,
    });
  }

  async handleUserCallback(code, state) {
    const decoded = verifyOAuthState(state);
    if (decoded.mode !== 'user') {
      throw new ValidationError('OAuth state does not match this request');
    }

    const id = decoded.mcpId;
    const mcp = await mcpRepository.findById(id);
    if (!mcp) throw new NotFoundError('MCP server not found');

    const tokenResponse = await exchangeCodeForToken({
      tokenEndpoint: mcp.oauth.tokenEndpoint,
      clientId: mcp.oauth.clientId,
      clientSecret: encryption.decrypt(mcp.oauth.clientSecretEncrypted),
      code,
      redirectUri: redirectUriFor('user'),
      codeVerifier: decoded.codeVerifier,
    });

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    await mcpUserConnectionRepository.upsert(id, decoded.userId, {
      accessTokenEncrypted: encryption.encrypt(tokenResponse.access_token),
      refreshTokenEncrypted: tokenResponse.refresh_token
        ? encryption.encrypt(tokenResponse.refresh_token)
        : null,
      expiresAt,
    });

    await this._invalidateAgentsUsingMcp(id);

    return decoded.returnTo || config.websiteUrl;
  }

  async getUserConnectionStatus(id, userId) {
    const connection = await mcpUserConnectionRepository.findByMcpAndUser(id, userId);
    return { connected: Boolean(connection) };
  }

  async disconnectUserConnection(id, userId) {
    await mcpUserConnectionRepository.deleteByMcpAndUser(id, userId);
    await this._invalidateAgentsUsingMcp(id);
  }

  async getAgentsByMcp(id) {
    return await Agent.find({ mcps: id }).select('name slug avatar visibility');
  }
}

export default new McpService();
