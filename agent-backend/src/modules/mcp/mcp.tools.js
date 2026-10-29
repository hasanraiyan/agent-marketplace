import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import mcpTokenService from './mcp-token.service.js';
import mcpRepository from './mcp.repository.js';
import { listUiTemplates } from './mcp-apps.client.js';
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
    return { tools: [], mcpAppMap: {}, mcpAuthRequired: [] };
  }

  const mcpServers = {};
  // User-mode OAuth servers skipped because this end user has no usable
  // connection. Surfaced to the caller so the AG-UI stream can tell the
  // client exactly which connectors need a "Connect" click — previously
  // these tools just vanished from the toolset with no signal at all.
  const mcpAuthRequired = [];
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
          // Only the end user can fix a user-mode connection; an owner-mode
          // token is a Project config problem, not something to prompt for.
          if (mcp.authMode === 'user') {
            mcpAuthRequired.push({
              mcpId: String(mcp._id),
              name: mcp.name,
              description: mcp.description || '',
            });
          }
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

      let storedTemplates = mcp.resourceTemplates || [];

      logger.info(`[MCP] "${mcp.name}" stored UI templates: ${storedTemplates.length}`, {
        serverKey,
        templates: storedTemplates.map((t) => ({
          toolName: t.toolName,
          uriTemplate: t.uriTemplate,
        })),
      });

      // User-mode OAuth connectors have no server-side credential, so Test
      // Connection (run as whoever is in the platform) can't discover widgets
      // and `resourceTemplates` stays empty - tools still work at runtime, but
      // no MCP App renders. This is the first point where an end user's token
      // definitely exists, so capture and persist the templates here; the run's
      // own mcpAppMap below picks them up immediately.
      const needsUserModeDiscovery =
        storedTemplates.length === 0 && mcp.authType === 'oauth' && mcp.authMode === 'user';
      if (needsUserModeDiscovery) {
        try {
          const appHeaders = token ? { Authorization: `Bearer ${token}` } : {};
          const discovered = await listUiTemplates(mcp, appHeaders);
          logger.info(
            `[MCP] "${mcp.name}" run-time UI template discovery: ${discovered.length} found`,
            { tools: discovered.map((t) => t.toolName) }
          );
          if (discovered.length > 0) {
            storedTemplates = discovered;
            // The caller is usually NOT this connector's owner (an end user
            // chats with someone else's agent), so the write is scoped by the
            // MCP document's own ownership, never by the run's context.
            const mcpOwnerFilter =
              mcp.ownerType === 'Project'
                ? { ownerType: 'Project', domain: mcp.domain ?? 'persona' }
                : mcp.ownerType === 'ExternalUser'
                  ? {
                      ownerType: 'ExternalUser',
                      externalOwnerId: mcp.externalOwnerId,
                      domain: mcp.domain ?? 'persona',
                    }
                  : { ownerId: mcp.ownerId };
            try {
              await mcpRepository.update(mcp._id, mcpOwnerFilter, {
                resourceTemplates: discovered,
              });
            } catch (persistErr) {
              logger.warn(
                `[MCP] failed to persist discovered UI templates for "${mcp.name}": ${persistErr?.message}`
              );
            }
          }
        } catch (discoveryErr) {
          logger.warn(
            `[MCP] run-time UI template discovery failed for "${mcp.name}": ${discoveryErr?.message}`
          );
        }
      }

      for (const tmpl of storedTemplates) {
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
    return { tools: [], mcpAppMap: {}, mcpAuthRequired };
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
    logger.info(`[MCP] mcpAppMap built: ${Object.keys(mcpAppMap).length} widget mappings`, {
      mcpAppMap,
    });
    return { tools, mcpAppMap, mcpAuthRequired };
  } catch (err) {
    logger.error(`[MCP] failed to load tools: ${err?.message}`);
    return { tools: [], mcpAppMap: {}, mcpAuthRequired };
  }
}
