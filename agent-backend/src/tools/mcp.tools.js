import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { DynamicStructuredTool } from '@langchain/core/tools';
import mcpTokenService from '../services/mcpToken.service.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Wraps an MCP tool to safely handle hallucinated parameters from the LLM.
 *
 * The LLM often guesses extra arguments (e.g. `length`, `brand_kit_id`,
 * `user_intent`) that the MCP server's schema didn't declare. This wrapper:
 * 1. Uses `.passthrough()` on the Zod schema so validation doesn't throw
 * 2. Strips unknown keys before passing input to the underlying MCP server
 *
 * @param {DynamicStructuredTool} tool - the raw MCP tool from the adapter
 * @returns {DynamicStructuredTool} a sanitized wrapper
 */
function sanitizeMcpTool(tool) {
  const schemaShape = tool.schema?.shape;
  if (!schemaShape) {
    return tool;
  }

  const allowedKeys = new Set(Object.keys(schemaShape));

  logger.debug(`[MCP] Sanitizing tool "${tool.name}": ${allowedKeys.size} declared params`);

  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.schema.passthrough(),
    func: async (input) => {
      const cleanInput = {};
      for (const key of Object.keys(input)) {
        if (allowedKeys.has(key)) {
          cleanInput[key] = input[key];
        } else {
          logger.debug(`[MCP] Stripping unexpected param "${key}" from tool "${tool.name}"`);
        }
      }
      return tool.func(cleanInput);
    },
  });
}

export async function resolveMcpTools(agent, userId) {
  if (!agent.mcps || agent.mcps.length === 0) {
    logger.info(`[MCP] No MCP servers attached to agent ${agent._id || agent.id}`);
    return { tools: [], mcpAppMap: {} };
  }

  const mcpServers = {};
  // Maps the agent's namespaced tool name (server-prefixed, matching what
  // `@langchain/mcp-adapters` produces below) to the MCP App widget it should
  // render. Built from each Mcp doc's `resourceTemplates`, captured by the last
  // Test Connection - `@langchain/mcp-adapters` drops `_meta` when it converts
  // an MCP tool into a LangChain tool, so this is the only place left that
  // still has the resourceUri by the time a tool call streams to the client.
  const mcpAppMap = {};

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

      const serverKey = mcp.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_');

      mcpServers[serverKey] = {
        transport: mcp.transport,
        url: mcp.url,
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      };

      for (const tmpl of mcp.resourceTemplates || []) {
        if (tmpl.toolName && tmpl.uriTemplate) {
          mcpAppMap[`${serverKey}__${tmpl.toolName}`] = {
            resourceUri: tmpl.uriTemplate,
            mcpId: String(mcp._id),
          };
        }
      }
    } catch (err) {
      logger.error(`[MCP] failed to prepare connection for "${mcp.name}": ${err?.message}`, {
        mcpId: String(mcp._id),
      });
    }
  }

  if (Object.keys(mcpServers).length === 0) {
    logger.info(`[MCP] No active MCP servers prepared for agent ${agent._id || agent.id}`);
    return { tools: [], mcpAppMap: {} };
  }

  const client = new MultiServerMCPClient({
    mcpServers,
    throwOnLoadError: false,
    onConnectionError: 'ignore',
    prefixToolNameWithServerName: true,
  });

  try {
    const rawTools = await client.getTools();
    const tools = rawTools.map(sanitizeMcpTool);
    logger.info(`[MCP] Successfully resolved ${tools.length} tools from ${Object.keys(mcpServers).length} active MCP servers: [${tools.map(t => t.name).join(', ')}]`);
    return { tools, mcpAppMap };
  } catch (err) {
    logger.error(`[MCP] failed to load tools: ${err?.message}`);
    return { tools: [], mcpAppMap: {} };
  }
}
