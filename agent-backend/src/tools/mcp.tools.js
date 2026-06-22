import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import mcpTokenService from '../services/mcpToken.service.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Resolves the live LangChain tools for every MCP server attached to an
 * agent. Each server is isolated in its own try/catch so one broken or
 * unreachable MCP doesn't fail the whole agent build. Owner-mode servers use
 * the connector's own stored token; user-mode servers use the current
 * end-user's own connection and are silently skipped if that user hasn't
 * connected yet (the frontend pre-flight banner is what tells them to).
 *
 * @param {Object} agent - populated Agent document (agent.mcps must be populated)
 * @param {string} userId - the end-user running this agent
 * @returns {Promise<Array>} LangChain tools
 */
export async function resolveMcpTools(agent, userId) {
  if (!agent.mcps || agent.mcps.length === 0) {
    logger.info(`[MCP] No MCP servers attached to agent ${agent._id || agent.id}`);
    return [];
  }

  const mcpServers = {};

  for (const mcp of agent.mcps) {
    if (mcp.isEnabled === false) {
      logger.info(`[MCP] Skipping disabled server "${mcp.name}" (id: ${mcp._id})`);
      continue;
    }

    try {
      let token = null;
      if (mcp.authType === 'oauth') {
        token =
          mcp.authMode === 'owner'
            ? await mcpTokenService.getOwnerAccessToken(mcp)
            : await mcpTokenService.getUserAccessToken(mcp, userId);

        if (!token) {
          logger.info(`[MCP] Skipping OAuth server "${mcp.name}" (id: ${mcp._id}) - missing user or owner token`);
          continue;
        }
      }

      logger.info(`[MCP] Preparing connection to server "${mcp.name}" (id: ${mcp._id}, url: ${mcp.url})`);

      const serverKey = String(mcp._id);
      mcpServers[serverKey] = {
        transport: mcp.transport,
        url: mcp.url,
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      };
    } catch (err) {
      logger.error(`[MCP] failed to prepare connection for "${mcp.name}": ${err?.message}`, {
        mcpId: String(mcp._id),
      });
    }
  }

  if (Object.keys(mcpServers).length === 0) {
    logger.info(`[MCP] No active MCP servers prepared for agent ${agent._id || agent.id}`);
    return [];
  }

  const client = new MultiServerMCPClient({
    mcpServers,
    throwOnLoadError: false,
    onConnectionError: 'ignore',
  });

  try {
    const tools = await client.getTools();
    logger.info(`[MCP] Successfully resolved ${tools.length} tools from ${Object.keys(mcpServers).length} active MCP servers: [${tools.map(t => t.name).join(', ')}]`);
    return tools;
  } catch (err) {
    logger.error(`[MCP] failed to load tools: ${err?.message}`);
    return [];
  }
}
