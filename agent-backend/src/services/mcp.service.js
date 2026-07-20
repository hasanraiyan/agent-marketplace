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
  dynamicClientRegistration,
  generatePkcePair,
  buildAuthorizationUrl,
  exchangeCodeForToken,
} from '../utils/mcpOAuthClient.js';
import config from '../config/index.js';
import NotFoundError from '../utils/errors/NotFoundError.js';
import ValidationError from '../utils/errors/ValidationError.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

function redirectUriFor(mode) {
  return `${config.backendUrl}/api/v1/mcps/oauth/${mode}/callback`;
}

class McpService {
  toSafeJson(mcp) {
    const obj = mcp.toObject ? mcp.toObject() : mcp;
    const { oauth, apiKeyEncrypted, ...rest } = obj;
    const safe = { ...rest, hasApiKey: Boolean(apiKeyEncrypted) };
    if (!oauth) return safe;
    return {
      ...safe,
      oauth: {
        clientId: oauth.clientId || null,
        hasClientSecret: Boolean(oauth.clientSecretEncrypted),
        authorizationEndpoint: oauth.authorizationEndpoint || null,
        tokenEndpoint: oauth.tokenEndpoint || null,
        scopes: oauth.scopes || [],
        dynamicallyRegistered: Boolean(oauth.dynamicallyRegistered),
        ownerConnected: Boolean(oauth.ownerToken?.accessTokenEncrypted),
      },
    };
  }

  async createMcp(userId, data) {
    /* unchanged */ const mcpData = {
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
      if (data.useDynamicRegistration) {
        if (!discovered.registrationEndpoint) {
          throw new ValidationError(
            'This MCP server does not support Dynamic Client Registration. Please provide a Client ID and Client Secret manually.'
          );
        }
        const registered = await dynamicClientRegistration({
          registrationEndpoint: discovered.registrationEndpoint,
          redirectUris: [redirectUriFor('owner'), redirectUriFor('user')],
          clientName: data.name,
          clientUri: config.websiteUrl,
        });
        mcpData.oauth = {
          clientId: registered.clientId,
          clientSecretEncrypted: registered.clientSecret
            ? encryption.encrypt(registered.clientSecret)
            : null,
          authorizationEndpoint: discovered.authorizationEndpoint,
          tokenEndpoint: discovered.tokenEndpoint,
          scopes: discovered.scopesSupported,
          dynamicallyRegistered: true,
          tokenEndpointAuthMethod: registered.tokenEndpointAuthMethod,
        };
      } else {
        if (!data.oauth?.clientId || !data.oauth?.clientSecret) {
          throw new ValidationError(
            'Client ID and Client Secret are required when auth type is oauth'
          );
        }
        mcpData.oauth = {
          clientId: data.oauth.clientId,
          clientSecretEncrypted: encryption.encrypt(data.oauth.clientSecret),
          authorizationEndpoint: discovered.authorizationEndpoint,
          tokenEndpoint: discovered.tokenEndpoint,
          scopes: data.oauth.scopes?.length ? data.oauth.scopes : discovered.scopesSupported,
          dynamicallyRegistered: false,
        };
      }
    } else if (mcpData.authType === 'apiKey') {
      if (!data.apiKey) {
        throw new ValidationError('API key is required when auth type is apiKey');
      }
      mcpData.apiKeyEncrypted = encryption.encrypt(data.apiKey);
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
      const isDcr = existing.oauth?.dynamicallyRegistered;
      if (!clientId) throw new ValidationError('Client ID is required when auth type is oauth');
      if (!isDcr && !Boolean(data.oauth?.clientSecret || existing.oauth?.clientSecretEncrypted)) {
        throw new ValidationError('Client Secret is required when auth type is oauth');
      }
      updateData.oauth = {
        clientId,
        clientSecretEncrypted: data.oauth?.clientSecret
          ? encryption.encrypt(data.oauth.clientSecret)
          : existing.oauth.clientSecretEncrypted,
        authorizationEndpoint:
          discovered?.authorizationEndpoint || existing.oauth.authorizationEndpoint,
        tokenEndpoint: discovered?.tokenEndpoint || existing.oauth.tokenEndpoint,
        scopes: data.oauth?.scopes || existing.oauth?.scopes || [],
        dynamicallyRegistered: existing.oauth?.dynamicallyRegistered || false,
        tokenEndpointAuthMethod: existing.oauth?.tokenEndpointAuthMethod || 'client_secret_basic',
        ownerToken: existing.oauth?.ownerToken || {},
      };
    } else if (resolvedAuthType === 'apiKey') {
      if (!data.apiKey && !existing.apiKeyEncrypted) {
        throw new ValidationError('API key is required when auth type is apiKey');
      }
      if (data.apiKey) updateData.apiKeyEncrypted = encryption.encrypt(data.apiKey);
      delete updateData.apiKey;
    } else if (data.authType === 'none') {
      updateData.oauth = {};
      updateData.apiKeyEncrypted = null;
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
    for (const agent of agents) agentFactory.invalidate(agent._id);
    return await mcpRepository.delete(id, userId);
  }

  async _invalidateAgentsUsingMcp(mcpId) {
    const agents = await Agent.find({ mcps: mcpId }, '_id');
    logger.info(
      `[MCP] Invalidating cache for ${agents.length} agents using MCP server (id: ${mcpId})`
    );
    for (const agent of agents) agentFactory.invalidate(agent._id);
  }

  // Raw SDK client declaring the capabilities Claude Desktop/ChatGPT send
  // (roots, sampling, the mcp_apps experimental flag). MultiServerMCPClient's
  // internal client declares none of these, which is why resources/list and
  // resources/read 404 on MCP Apps servers (e.g. Canva) when called through it.
  async _connectAppsClient(mcp, headers) {
    const { Client: McpClient } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } =
      await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');

    const parsedUrl = new URL(mcp.url);
    const hasHeaders = Object.keys(headers).length > 0;

    const transport =
      mcp.transport === 'sse'
        ? new SSEClientTransport(parsedUrl, { requestInit: hasHeaders ? { headers } : undefined })
        : new StreamableHTTPClientTransport(parsedUrl, {
            requestInit: hasHeaders ? { headers } : undefined,
          });

    const client = new McpClient({
      name: 'agent-marketplace',
      version: '1.0.0',
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
        experimental: { mcp_apps: {} },
      },
    });

    await client.connect(transport);
    return { client, transport };
  }

  // Builds the request headers for connecting to an MCP server under any
  // supported authType. Shared by testConnection() and readResource() so
  // adding/fixing an auth method only has to happen in one place.
  async _resolveAuthHeaders(mcp, userId, actionLabel) {
    const headers = {};
    if (mcp.authType === 'oauth') {
      const token =
        mcp.authMode === 'owner'
          ? await mcpTokenService.getOwnerAccessToken(mcp)
          : await mcpTokenService.getUserAccessToken(mcp, userId);
      if (!token) {
        throw new ValidationError(
          mcp.authMode === 'owner'
            ? 'Owner has not authenticated with this MCP server. Connect your account first.'
            : `You need to authenticate with this MCP server before ${actionLabel}. Connect your account first.`
        );
      }
      headers.Authorization = `Bearer ${token}`;
    } else if (mcp.authType === 'apiKey') {
      const token = mcpTokenService.getApiKeyToken(mcp);
      if (!token) {
        throw new ValidationError(
          'This MCP server has no API key configured. Add one in its settings first.'
        );
      }
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  async testConnection(id, userId) {
    const mcp = await this.getMcpById(id, userId);
    const headers = await this._resolveAuthHeaders(mcp, userId, 'testing');

    const adapterClient = new MultiServerMCPClient({
      mcpServers: {
        [String(mcp._id)]: { transport: mcp.transport, url: mcp.url, headers },
      },
    });

    let toolSummaries = [];
    let resourceSummaries = [];
    let templateSummaries = [];
    try {
      const tools = await adapterClient.getTools();
      toolSummaries = tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
      }));

      try {
        const resourcesByServer = await adapterClient.listResources(String(mcp._id));
        const serverResources = resourcesByServer?.[String(mcp._id)] || [];
        resourceSummaries = serverResources.map((resource) => ({
          uri: resource.uri,
          name: resource.name || '',
          description: resource.description || '',
          mimeType: resource.mimeType || '',
        }));
      } catch (resErr) {
        logger.warn(`[MCP] Failed to list resources for "${mcp.name}": ${resErr?.message}`);
      }

      // Try to extract _meta.ui templates from tools using a raw SDK client
      // with standard MCP capabilities (matching what Claude Desktop/ChatGPT send)
      let appsClient;
      try {
        appsClient = await this._connectAppsClient(mcp, headers);

        // Fetch tools to check for _meta.ui.resourceUri
        let toolsResponse;
        const allMcpTools = [];
        do {
          toolsResponse = await appsClient.client.listTools({
            ...(toolsResponse?.nextCursor ? { cursor: toolsResponse.nextCursor } : {}),
          });
          allMcpTools.push(...(toolsResponse.tools || []));
        } while (toolsResponse.nextCursor);

        for (const rawTool of allMcpTools) {
          if (rawTool._meta?.ui?.resourceUri) {
            templateSummaries.push({
              uriTemplate: rawTool._meta.ui.resourceUri,
              name: rawTool.name || '',
              description: (rawTool._meta.ui.description || rawTool.description || '').substring(
                0,
                200
              ),
              mimeType: rawTool._meta.ui.mimeType || 'text/html',
              toolName: rawTool.name,
            });
          }
        }
      } catch (mcErr) {
        logger.debug(
          `[MCP] Could not extract _meta.ui templates for "${mcp.name}": ${mcErr?.message}`
        );
      } finally {
        try {
          await appsClient?.transport.close();
          await appsClient?.client.close();
        } catch {
          /* best-effort cleanup */
        }
      }
    } catch (err) {
      logger.warn(`[MCP] Failed to list tools for "${mcp.name}": ${err?.message}`);
    } finally {
      await adapterClient.close?.();
    }

    logger.info(
      `[MCP] Test connection for "${mcp.name}": ${toolSummaries.length} tools, ${resourceSummaries.length} resources, ${templateSummaries.length} templates`
    );

    await mcpRepository.update(id, userId, {
      tools: toolSummaries,
      resources: resourceSummaries,
      resourceTemplates: templateSummaries,
      lastTestedAt: new Date(),
    });
    // The templates just discovered feed the agent build's tool->widget map
    // (see tools/mcp.tools.js) - agents using this server must rebuild to pick
    // them up, the same as any other config change to this connector.
    await this._invalidateAgentsUsingMcp(id);

    return {
      tools: toolSummaries,
      resources: resourceSummaries,
      resourceTemplates: templateSummaries,
    };
  }

  async getOwnerAuthorizationUrl(id, userId) {
    const mcp = await this.getMcpById(id, userId);
    if (mcp.authType !== 'oauth') throw new ValidationError('This MCP server does not use OAuth');
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = signOAuthState({
      mcpId: String(id),
      userId: String(userId),
      mode: 'owner',
      codeVerifier,
    });
    return buildAuthorizationUrl({
      authorizationEndpoint: mcp.oauth.authorizationEndpoint,
      clientId: mcp.oauth.clientId,
      redirectUri: redirectUriFor('owner'),
      codeChallenge,
      state,
      scopes: mcp.oauth.scopes,
    });
  }

  async handleOwnerCallback(code, state) {
    const decoded = verifyOAuthState(state);
    if (decoded.mode !== 'owner')
      throw new ValidationError('OAuth state does not match this request');
    const id = decoded.mcpId;
    const mcp = await mcpRepository.findById(id);
    if (!mcp) throw new NotFoundError('MCP server not found');
    const clientSecret = mcp.oauth.clientSecretEncrypted
      ? encryption.decrypt(mcp.oauth.clientSecretEncrypted)
      : null;
    const tokenResponse = await exchangeCodeForToken({
      tokenEndpoint: mcp.oauth.tokenEndpoint,
      clientId: mcp.oauth.clientId,
      clientSecret,
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
    if (decoded.mode !== 'user')
      throw new ValidationError('OAuth state does not match this request');
    const id = decoded.mcpId;
    const mcp = await mcpRepository.findById(id);
    if (!mcp) throw new NotFoundError('MCP server not found');
    const clientSecret = mcp.oauth.clientSecretEncrypted
      ? encryption.decrypt(mcp.oauth.clientSecretEncrypted)
      : null;
    const tokenResponse = await exchangeCodeForToken({
      tokenEndpoint: mcp.oauth.tokenEndpoint,
      clientId: mcp.oauth.clientId,
      clientSecret,
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

  async disconnectOwnerConnection(id, userId) {
    const mcp = await this.getMcpById(id, userId);
    if (!mcp.oauth?.ownerToken?.accessTokenEncrypted) {
      throw new ValidationError('No owner connection to disconnect');
    }
    await mcpRepository.update(id, userId, {
      oauth: {
        ...mcp.oauth.toObject(),
        ownerToken: {},
      },
    });
    await this._invalidateAgentsUsingMcp(id);
  }

  async getAgentsByMcp(id) {
    return await Agent.find({ mcps: id }).select('name slug avatar visibility');
  }

  async readResource(id, userId, resourceUri) {
    const mcp = await this.getMcpById(id, userId);
    const headers = await this._resolveAuthHeaders(mcp, userId, 'connecting');

    // Use the same capability-declaring client as testConnection()'s _meta.ui
    // extraction - MultiServerMCPClient's bare client (no declared capabilities)
    // gets "Method not found" from MCP Apps servers like Canva's.
    const { client, transport } = await this._connectAppsClient(mcp, headers);

    try {
      const result = await client.readResource({ uri: resourceUri });
      const contents = result?.contents;
      if (!contents || contents.length === 0) {
        throw new ValidationError('Resource returned no content');
      }
      return {
        text: contents[0].text || '',
        mimeType: contents[0].mimeType || 'text/html',
      };
    } finally {
      try {
        await transport.close();
        await client.close();
      } catch {
        /* best-effort cleanup */
      }
    }
  }

  // Proxies a `tools/call` for an MCP App widget's `app.callServerTool()`.
  // The widget runs in the browser and has no credentials of its own - this
  // keeps auth (OAuth tokens, API keys) server-side like every other MCP call.
  async callTool(id, userId, toolName, args) {
    const mcp = await this.getMcpById(id, userId);
    const headers = await this._resolveAuthHeaders(mcp, userId, 'connecting');
    const { client, transport } = await this._connectAppsClient(mcp, headers);

    try {
      return await client.callTool({ name: toolName, arguments: args || {} });
    } finally {
      try {
        await transport.close();
        await client.close();
      } catch {
        /* best-effort cleanup */
      }
    }
  }
}

export default new McpService();
