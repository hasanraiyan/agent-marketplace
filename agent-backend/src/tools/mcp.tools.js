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
  if (!agent.mcps || agent.mcps.length === 0) return [];

  const mcpServers = {};

  for (const mcp of agent.mcps) {
    if (mcp.isEnabled === false) continue;

    try {
      let token = null;
      if (mcp.authType === 'oauth') {
        token =
          mcp.authMode === 'owner'
            ? await mcpTokenService.getOwnerAccessToken(mcp)
            : await mcpTokenService.getUserAccessToken(mcp, userId);

        if (!token) {
          // Owner never connected, or this user hasn't connected yet - skip
          // this server's tools for this run rather than failing the build.
          continue;
        }
      }

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

  if (Object.keys(mcpServers).length === 0) return [];

  const client = new MultiServerMCPClient({
    mcpServers,
    throwOnLoadError: false,
    onConnectionError: 'ignore',
  });

  try {
    return await client.getTools();
  } catch (err) {
    logger.error(`[MCP] failed to load tools: ${err?.message}`);
    return [];
  }
}
