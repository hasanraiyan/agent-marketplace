import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import mcpRepository from './mcp.repository.js';
import mcpUserConnectionRepository, {
  subjectFilterForContext,
} from './mcp-user-connection.repository.js';
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import encryption from '../../utils/encryption.js';
import mcpTokenService from './mcp-token.service.js';
import { signOAuthState, verifyOAuthState } from './oauth-state.js';
import {
  discoverOAuthEndpoints,
  dynamicClientRegistration,
  generatePkcePair,
  buildAuthorizationUrl,
  exchangeCodeForToken,
} from './mcp-oauth-client.js';
import config from '../../config/index.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import { loggerService } from '../../utils/index.js';
import { personaExecutionContext } from '../agents/agent.service.js';
import {
  isResourceOwner,
  ownerFilterForContext,
  ownerFieldsForContext,
} from '../../utils/resourceOwnership.js';
import { scopedFilter } from '../../utils/domainQuery.js';

const logger = loggerService.getLogger();

function redirectUriFor(mode) {
  return `${config.backendUrl}/api/v1/mcps/oauth/${mode}/callback`;
}

/**
 * Developer Platform (AD-05 §17, blueprint Phase 9, PR-47c): a
 * McpUserConnection belongs to a Subject (who connected their own
 * account), not an Owner — same distinction as Thread (AD-04 §15.3). The
 * filter half of this (`subjectFilterForContext`) now lives in
 * `mcp-user-connection.repository.js` — shared with `mcp-token.service.js`
 * (PR-48) — this fields-shaped half stays local since only the OAuth
 * connect flow (not runtime token resolution) needs to persist
 * `subjectType`.
 */
function connectionSubjectFields(context) {
  if (context?.principalType === 'ProjectRuntime') {
    return {
      domain: context.domain,
      subjectType: 'ExternalUser',
      externalUserId: context.externalUserId,
    };
  }
  return { subjectType: 'PersonaUser', userId: context?.personaUserId };
}

/**
 * Reconstructs an execution-context-shaped object from a verified,
 * signed OAuth state payload (never from raw, caller-supplied
 * domain/subject on the live callback request — AD-02 §16, AD-07 §25).
 */
function contextFromOAuthState(decoded) {
  return {
    domain: decoded.domain,
    principalType: decoded.principalType,
    personaUserId: decoded.personaUserId,
    externalUserId: decoded.externalUserId,
  };
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

  /**
   * Developer Platform (blueprint Phase 9, PR-34): `context` defaults to
   * `personaExecutionContext(userId)`, so every existing caller (the
   * Persona `POST /mcps` route) that omits it gets byte-for-byte identical
   * behavior. Same treatment as Skill's `createSkill` (PR-28) — MCP
   * creation has no Persona-only onboarding complexity, so this one method
   * serves all three owner types directly.
   */
  async createMcp(userId, data, context = personaExecutionContext(userId)) {
    const mcpData = {
      ...ownerFieldsForContext(context),
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

  /**
   * Developer Platform (AD-07 §19, blueprint Phase 9, PR-46): the Discovery
   * Contract — a GENUINELY SEPARATE code path from `getMyMcps` above (which
   * only ever lists the Persona caller's own MCPs), mirroring Agent's
   * PR-43 / Skill's PR-44 / Knowledge's PR-45 treatment.
   *
   * Unlike those three resources, Mcp has NO `isPublic`/`visibility` field
   * at all — an MCP definition has no "browse other people's MCP servers"
   * product concept the way an Agent/Skill/Knowledge Base does; MCPs exist
   * to be attached to Agents, not consumed directly. Attachment itself
   * already uses a Domain-boundary-is-sufficient policy (mirrors
   * `agent.service.js`'s `assertOwnsProvider`, AD-06 §12 — any of a
   * Project's own Agents may use any MCP owned within that same Domain,
   * not just ones the same Subject created). Discovery follows the exact
   * same reasoning: there is no third "public browse" subset to carve out
   * of "everything in the Domain" — so the two non-`mine` modes below
   * collapse to the same Domain-scoped, unrestricted-by-owner filter.
   *   - `ProjectMachineContext`/`ProjectAdminContext` OR
   *     `ProjectRuntimeContext` without `filters.scope === 'mine'`: every
   *     MCP in this Project's own Domain, any owner type.
   *   - `ProjectRuntimeContext` with `filters.scope === 'mine'`: Domain-
   *     and Subject-scoped to just that external user's own MCPs.
   */
  _buildDeveloperDiscoveryFilter(context, filters = {}) {
    const extra = {};
    if (filters.search) {
      extra.name = { $regex: filters.search, $options: 'i' };
    }

    if (context?.principalType === 'ProjectRuntime' && filters.scope === 'mine') {
      return scopedFilter(context.domain, {
        ...extra,
        ownerType: 'ExternalUser',
        externalOwnerId: context.externalUserId,
      });
    }

    return scopedFilter(context?.domain, extra);
  }

  async discoverMcps(context, filters, pagination) {
    const match = this._buildDeveloperDiscoveryFilter(context, filters);
    return await mcpRepository.search(match, pagination);
  }

  async countDiscoverMcps(context, filters) {
    const match = this._buildDeveloperDiscoveryFilter(context, filters);
    return await mcpRepository.count(match);
  }

  /**
   * Fetches an MCP by ID with an ownership check. `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for every
   * existing (Persona) caller, including the many internal call sites below
   * (testConnection, readResource, callTool, etc.) that stay Persona-only
   * and call this with just `(id, userId)`.
   */
  async getMcpById(id, userId, context = personaExecutionContext(userId)) {
    const mcp = await mcpRepository.findById(id);
    if (!mcp || !isResourceOwner(mcp, context)) {
      throw new NotFoundError('MCP server not found');
    }
    return mcp;
  }

  /**
   * Updates an existing MCP. `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for every
   * existing caller. Repository enforces ownership atomically via
   * `ownerFilterForContext(context)`, replacing the previous hardcoded
   * `{ ownerId: userId }` shape (Persona callers get the exact same filter
   * as before).
   */
  async updateMcp(id, userId, data, context = personaExecutionContext(userId)) {
    const existing = await this.getMcpById(id, userId, context);
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
    const mcp = await mcpRepository.update(id, ownerFilterForContext(context), updateData);
    await this._invalidateAgentsUsingMcp(id);
    return mcp;
  }

  /**
   * Deletes an MCP and removes it from all agents. `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for every
   * existing caller.
   */
  async deleteMcp(id, userId, context = personaExecutionContext(userId)) {
    const mcp = await this.getMcpById(id, userId, context);
    const agents = await agentRepository.findAgentsUsingMcp(id, '_id');
    await agentRepository.removeMcpFromAgents(id);
    await mcpUserConnectionRepository.deleteByMcp(id);
    for (const agent of agents) agentFactory.invalidate(agent._id);
    return await mcpRepository.delete(id, ownerFilterForContext(context));
  }

  async _invalidateAgentsUsingMcp(mcpId) {
    const agents = await agentRepository.findAgentsUsingMcp(mcpId, '_id');
    logger.info(
      `[MCP] Invalidating cache for ${agents.length} agents using MCP server (id: ${mcpId})`
    );
    for (const agent of agents) agentFactory.invalidate(agent._id);
  }

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

  /**
   * Developer Platform (blueprint Phase 9, PR-47c/PR-48): `context` is
   * optional and only consulted for the `authMode: 'user'` branch — passed
   * straight through to `mcpTokenService.getUserAccessToken`, which builds
   * the correct Subject filter for any principal type (PR-48 closed the
   * Phase 7 gap this used to fail closed against).
   */
  async _resolveAuthHeaders(mcp, userId, actionLabel, context) {
    const headers = {};
    if (mcp.authType === 'oauth') {
      let token;
      if (mcp.authMode === 'owner') {
        token = await mcpTokenService.getOwnerAccessToken(mcp);
      } else {
        token = await mcpTokenService.getUserAccessToken(mcp, userId, context);
      }
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

  /**
   * Developer Platform (blueprint Phase 9, PR-47c): `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for the
   * existing Persona route.
   */
  async testConnection(id, userId, context = personaExecutionContext(userId)) {
    const mcp = await this.getMcpById(id, userId, context);
    const headers = await this._resolveAuthHeaders(mcp, userId, 'testing', context);

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

      let appsClient;
      try {
        appsClient = await this._connectAppsClient(mcp, headers);

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

    await mcpRepository.update(id, ownerFilterForContext(context), {
      tools: toolSummaries,
      resources: resourceSummaries,
      resourceTemplates: templateSummaries,
      lastTestedAt: new Date(),
    });
    await this._invalidateAgentsUsingMcp(id);

    return {
      tools: toolSummaries,
      resources: resourceSummaries,
      resourceTemplates: templateSummaries,
    };
  }

  /**
   * Developer Platform (blueprint Phase 9, PR-47c, AD-07 §25): `context`
   * defaults to `personaExecutionContext(userId)` — zero behavior change
   * for the existing Persona route. The Owner OAuth flow's shared token is
   * used by everyone who invokes the MCP's tools regardless of Subject, so
   * this stays an Owner-model (not Subject-model) operation — the signed
   * state carries enough of `context` to reconstruct it for the
   * unauthenticated callback (never trusting a caller-supplied
   * domain/subject on the callback request itself, AD-02 §16).
   */
  async getOwnerAuthorizationUrl(id, userId, context = personaExecutionContext(userId)) {
    const mcp = await this.getMcpById(id, userId, context);
    if (mcp.authType !== 'oauth') throw new ValidationError('This MCP server does not use OAuth');
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = signOAuthState({
      mcpId: String(id),
      mode: 'owner',
      domain: context.domain,
      principalType: context.principalType,
      personaUserId: context.personaUserId ? String(context.personaUserId) : undefined,
      externalUserId: context.externalUserId,
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
    const callbackContext = contextFromOAuthState(decoded);
    if (!isResourceOwner(mcp, callbackContext)) {
      throw new ValidationError('OAuth state does not match this request');
    }
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
    await mcpRepository.update(id, ownerFilterForContext(callbackContext), {
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

  /**
   * Developer Platform (blueprint Phase 9, PR-47c): `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for the
   * existing Persona route. Per-user connections are Subject-scoped
   * (AD-05 §17) — restricted to the MCP's own Domain, same
   * Domain-boundary reasoning `assertOwnsProvider` already established
   * for Provider attachment (AD-06 §12): any Subject within the MCP's
   * Domain may connect their own account, existence-hidden to a 404 for a
   * cross-Domain attempt rather than a distinguishable error.
   */
  async getUserAuthorizationUrl(id, userId, returnTo, context = personaExecutionContext(userId)) {
    const mcp = await mcpRepository.findById(id);
    if (!mcp) throw new NotFoundError('MCP server not found');
    if (mcp.domain && context.domain && mcp.domain !== context.domain) {
      throw new NotFoundError('MCP server not found');
    }
    if (mcp.authType !== 'oauth' || mcp.authMode !== 'user') {
      throw new ValidationError('This MCP server is not configured for per-user authentication');
    }
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = signOAuthState({
      mcpId: String(id),
      mode: 'user',
      domain: context.domain,
      principalType: context.principalType,
      personaUserId: context.personaUserId ? String(context.personaUserId) : undefined,
      externalUserId: context.externalUserId,
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
    const callbackContext = contextFromOAuthState(decoded);
    await mcpUserConnectionRepository.upsert(id, subjectFilterForContext(callbackContext), {
      ...connectionSubjectFields(callbackContext),
      accessTokenEncrypted: encryption.encrypt(tokenResponse.access_token),
      refreshTokenEncrypted: tokenResponse.refresh_token
        ? encryption.encrypt(tokenResponse.refresh_token)
        : null,
      expiresAt,
    });
    await this._invalidateAgentsUsingMcp(id);
    return decoded.returnTo || config.websiteUrl;
  }

  async getUserConnectionStatus(id, userId, context = personaExecutionContext(userId)) {
    const connection = await mcpUserConnectionRepository.findByMcpAndUser(
      id,
      subjectFilterForContext(context)
    );
    return { connected: Boolean(connection) };
  }

  async disconnectUserConnection(id, userId, context = personaExecutionContext(userId)) {
    await mcpUserConnectionRepository.deleteByMcpAndUser(id, subjectFilterForContext(context));
    await this._invalidateAgentsUsingMcp(id);
  }

  async disconnectOwnerConnection(id, userId, context = personaExecutionContext(userId)) {
    const mcp = await this.getMcpById(id, userId, context);
    if (!mcp.oauth?.ownerToken?.accessTokenEncrypted) {
      throw new ValidationError('No owner connection to disconnect');
    }
    await mcpRepository.update(id, ownerFilterForContext(context), {
      oauth: {
        ...mcp.oauth.toObject(),
        ownerToken: {},
      },
    });
    await this._invalidateAgentsUsingMcp(id);
  }

  async getAgentsByMcp(id) {
    return await agentRepository.findAgentsUsingMcp(id, 'name slug avatar visibility');
  }

  async readResource(id, userId, resourceUri, context = personaExecutionContext(userId)) {
    const mcp = await this.getMcpById(id, userId, context);
    const headers = await this._resolveAuthHeaders(mcp, userId, 'connecting', context);
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

  async callTool(id, userId, toolName, args, context = personaExecutionContext(userId)) {
    const mcp = await this.getMcpById(id, userId, context);
    const headers = await this._resolveAuthHeaders(mcp, userId, 'connecting', context);
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
