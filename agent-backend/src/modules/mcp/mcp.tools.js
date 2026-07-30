import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import mcpTokenService from './mcp-token.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Recursively rebuilds a Zod schema so every field (at every depth) becomes
 * optional, and any value that doesn't match its expected type/shape is
 * silently dropped (turned into `undefined`) instead of failing validation.
 * Unknown object keys are dropped too, for free, by Zod's default object
 * behavior (no `.passthrough()` needed once nothing is required).
 *
 * LLMs routinely send extra, missing, or mistyped tool arguments -
 * hallucinated fields nested arbitrarily deep, "" instead of omitting an
 * optional value, wrong enum members, a string where a number was expected.
 * None of that should fail the whole call: the underlying MCP server
 * re-validates and applies its own defaults/required-field errors anyway, so
 * loosening client-side just moves "bad input" from a hard local
 * ToolInputParsingException into a normal (recoverable) MCP tool-call error
 * surfaced by the server - one the agent can see and retry from instead of
 * crashing the run.
 */
function loosenSchema(schema) {
  const def = schema?.def;
  if (!def) return schema;

  let loosened;
  if (def.type === 'object') {
    const shape = {};
    for (const [key, value] of Object.entries(def.shape)) {
      shape[key] = loosenSchema(value);
    }
    loosened = z.object(shape);
  } else if (def.type === 'array') {
    loosened = z.array(loosenSchema(def.element));
  } else if (['optional', 'nullable', 'default', 'readonly', 'nonoptional'].includes(def.type)) {
    return loosenSchema(def.innerType);
  } else {
    // Leaf type (string, number, boolean, enum, literal, union, ...) - keep
    // its real validation so the model still gets accurate type guidance.
    loosened = schema;
  }

  return z.preprocess((value) => {
    if (value === undefined) return undefined;
    const result = loosened.safeParse(value);
    return result.success ? result.data : undefined;
  }, loosened.optional());
}

/**
 * Wraps an MCP tool so a malformed tool call never throws a hard
 * ToolInputParsingException that kills the whole agent run. See
 * loosenSchema() above for how the schema is relaxed.
 *
 * @param {DynamicStructuredTool} tool - the raw MCP tool from the adapter
 * @returns {DynamicStructuredTool} a sanitized wrapper
 */
function sanitizeMcpTool(tool) {
  if (tool.schema?.def?.type !== 'object') {
    return tool;
  }

  logger.debug(`[MCP] Loosening schema for tool "${tool.name}"`);

  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: loosenSchema(tool.schema),
    func: (...args) => tool.func(...args),
  });
}

/**
 * Developer Platform (blueprint Phase 9, PR-48): `context` closes the
 * Phase 7 gap this file's callers have carried since PR-23a — defaults to
 * a Persona-shaped context built from `userId` (zero behavior change for
 * every existing caller), forwarded to `mcpTokenService.getUserAccessToken`
 * so an `authMode: 'user'` MCP resolves the right Subject's own connection
 * regardless of whether the caller is a Persona User or a Project's
 * external user.
 */
export async function resolveMcpTools(
  agent,
  userId,
  context = { principalType: 'PersonaUser', personaUserId: userId }
) {
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
            : await mcpTokenService.getUserAccessToken(mcp, userId, context);

        if (!token) {
          logger.info(
            `[MCP] Skipping OAuth server "${mcp.name}" (id: ${mcp._id}) - missing user or owner token`
          );
          continue;
        }
      } else if (mcp.authType === 'apiKey') {
        token = mcpTokenService.getApiKeyToken(mcp);

        if (!token) {
          logger.info(
            `[MCP] Skipping API-key server "${mcp.name}" (id: ${mcp._id}) - no API key configured`
          );
          continue;
        }
      }

      logger.info(
        `[MCP] Preparing connection to server "${mcp.name}" (id: ${mcp._id}, url: ${mcp.url})`
      );

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
    logger.info(
      `[MCP] Successfully resolved ${tools.length} tools from ${Object.keys(mcpServers).length} active MCP servers: [${tools.map((t) => t.name).join(', ')}]`
    );
    return { tools, mcpAppMap };
  } catch (err) {
    logger.error(`[MCP] failed to load tools: ${err?.message}`);
    return { tools: [], mcpAppMap: {} };
  }
}
