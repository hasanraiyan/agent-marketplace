import { DynamicStructuredTool } from '@langchain/core/tools';
import { buildArgsSchema, renderTool, ReservedTokenUnresolvedError } from './templateEngine.js';
import { applyResponseMappings } from './responseMapper.js';
import projectSecretService from '../projects/projectSecret.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();
const CALL_TIMEOUT_MS = 15000;

function slugifyToolName(name) {
  return (name || 'rest_api_tool')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

function appendQuery(url, queryParams) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(queryParams || {})) {
    if (value !== '' && value !== undefined && value !== null) {
      parsed.searchParams.set(key, value);
    }
  }
  return parsed.toString();
}

/**
 * Builds one LangChain `DynamicStructuredTool` from a `RestApiTool`-shaped
 * plain object. Deliberately generic over *any* such object, not a
 * Mongoose document specifically — `buildArgsSchema`/`renderTool` already
 * only read plain fields — so this works identically for a persisted
 * `RestApiTool` doc (`resolveRestApiTools` below) or a freshly-fetched,
 * schema-validated manifest entry
 * (`restApiToolSources/restApiToolSource.tools.js`).
 *
 * Logging discipline (spec requirement): only `tool.name`, HTTP method,
 * and status code are ever logged here — never headers, body, or
 * `context.externalUserId`.
 */
export function buildRestApiToolLangchainTool(tool, context) {
  const schema = buildArgsSchema(tool);
  return new DynamicStructuredTool({
    name: slugifyToolName(tool.name),
    description: tool.description || `Calls the ${tool.name} REST API.`,
    schema,
    func: async (agentArgs) => {
      const startedAt = Date.now();
      try {
        const rendered = renderTool(tool, { agentArgs, context });
        const headers = { 'Content-Type': 'application/json', ...rendered.headers };
        if (tool.authType === 'bearerSecret' && tool.secretRef) {
          const secretValue = await projectSecretService.resolvePlaintext(tool.secretRef);
          headers.Authorization = `Bearer ${secretValue}`;
        }

        const res = await fetch(appendQuery(rendered.url, rendered.queryParams), {
          method: tool.method,
          headers,
          body: rendered.body ?? undefined,
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        });
        const text = await res.text();
        let json;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = text;
        }

        logger.info(
          `[RestApiTool] "${tool.name}" ${tool.method} -> ${res.status} (${Date.now() - startedAt}ms)`
        );

        if (!res.ok) {
          return `Request failed with status ${res.status}.`;
        }
        return JSON.stringify(applyResponseMappings(json, tool.responseMappings));
      } catch (err) {
        if (err instanceof ReservedTokenUnresolvedError) {
          logger.warn(`[RestApiTool] "${tool.name}" blocked: reserved token unresolved`);
          return `Tool call blocked: ${err.message}`;
        }
        logger.error(`[RestApiTool] "${tool.name}" failed: ${err?.message}`);
        return `Error calling ${tool.name}: ${err?.message}`;
      }
    },
  });
}

/**
 * Builds one LangChain `DynamicStructuredTool` per attached+enabled
 * RestApiTool (REST API Tool Builder, PERSONA_REST_TOOL_REQUEST.md).
 * Mirrors `mcp.tools.js#resolveMcpTools`'s shape: same `(agent, userId,
 * context)` signature, aggregated the same way in `tools/index.js`.
 */
export async function resolveRestApiTools(agent, userId, context) {
  if (!agent.restApiTools || agent.restApiTools.length === 0) {
    return [];
  }

  const tools = [];
  for (const tool of agent.restApiTools) {
    if (tool.isEnabled === false) continue;

    try {
      tools.push(buildRestApiToolLangchainTool(tool, context));
    } catch (err) {
      logger.error(`[RestApiTool] failed to build tool "${tool.name}": ${err?.message}`);
    }
  }

  return tools;
}
