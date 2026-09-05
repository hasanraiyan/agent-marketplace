import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createRcpClient } from 'rcp-sdk/client';
import projectSecretService from '../projects/projectSecret.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

function slugify(name) {
  return (name || 'rcp')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

function zodTypeFor(type) {
  if (type === 'number') return z.number();
  if (type === 'boolean') return z.boolean();
  return z.string();
}

function buildArgsSchema(exposedParams) {
  const shape = {};
  for (const param of exposedParams) {
    let field = zodTypeFor(param.type);
    if (param.description) field = field.describe(param.description);
    shape[param.name] = param.required === false ? field.optional() : field;
  }
  return z.object(shape);
}

/**
 * Builds a `createRcpClient()` for one source: auth from its own
 * `authType`/`secretRef` (exactly `rcpSource.service.js#_buildClientFor`'s
 * logic, independent copy — kept in this module rather than imported so
 * `rcpSource.tools.js` never depends on the service layer, matching how
 * `restApiToolSource.tools.js` never imports `restApiToolSource.service.js`
 * either), plus the identity header when a verified external user exists
 * for this call — RCP's client-injected-headers mechanism
 * (`rcp-sdk`'s own docs), not the resolver mechanism, per the confirmed
 * design decision.
 */
async function buildClientFor(source, context) {
  let auth = { type: 'none' };
  if (source.authType === 'header' && source.secretRef) {
    const secret = await projectSecretService.resolvePlaintext(source.secretRef);
    auth = { type: 'header', secret };
  }

  const headers = {};
  if (context?.principalType === 'ProjectRuntime' && context.externalUserId) {
    headers['X-Persona-External-User-Id'] = () => context.externalUserId;
  }

  return createRcpClient({ auth, headers, logger });
}

/**
 * Builds LangChain tools by discovering each attached+enabled RcpSource's
 * manifest **live, via `rcp-sdk`'s `createRcpClient().discover()`, on every
 * call** — mirrors `resolveRestApiToolSourceTools`'s shape and resilience
 * posture exactly: a bad/unreachable/invalid source is logged and skipped,
 * never thrown, so one broken source never kills the whole agent run. The
 * source's own `tools[]` field (a dashboard-display cache written by Test
 * Connection) is never read here.
 *
 * Tool names are namespaced `${sourceSlug}__${toolSlug}` to avoid
 * collisions across multiple attached sources, same convention as REST
 * Tool Sources and MCP.
 */
export async function resolveRcpSourceTools(agent, userId, context) {
  if (!agent.rcpSources || agent.rcpSources.length === 0) {
    return [];
  }

  const tools = [];
  for (const source of agent.rcpSources) {
    if (source.isEnabled === false) continue;

    try {
      const client = await buildClientFor(source, context);
      const { tools: discoveredTools } = await client.discover(source.url, context);
      const sourceSlug = slugify(source.name);

      for (const tool of discoveredTools) {
        try {
          const schema = buildArgsSchema(tool.exposedParams);
          tools.push(
            new DynamicStructuredTool({
              name: `${sourceSlug}__${slugify(tool.name)}`,
              description: tool.description || `Calls the ${tool.name} RCP tool.`,
              schema,
              func: async (agentArgs) => {
                try {
                  const result = await client.call(tool, agentArgs, context);
                  if (!result.ok) {
                    return `Request failed with status ${result.status}.`;
                  }
                  return JSON.stringify(result.mapped ?? result.raw);
                } catch (err) {
                  return `Error calling ${tool.name}: ${err?.message}`;
                }
              },
            })
          );
        } catch (err) {
          logger.error(`[RcpSource] "${source.name}" failed to build tool "${tool.name}": ${err?.message}`);
        }
      }
    } catch (err) {
      logger.warn(`[RcpSource] failed to load tools from "${source.name}": ${err?.message}`);
    }
  }

  return tools;
}
