import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createRcpClient } from 'rcp-sdk/client';
import { getConfig } from '@langchain/langgraph';
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
 *
 * `resolvers` (TURN_CONTEXT_RCP_RESOLVERS_PLAN.md) is built purely from this
 * source's static `paramContextMap` — param names only, no values — so it's
 * safe to construct here even though this whole function only runs on a
 * `buildAgent()` cache miss (see rcpSource.tools.js's `resolveRcpSourceTools`
 * doc comment for why the *values* can never be baked in here).
 */
async function buildClientFor(source, context, resolvers) {
  let auth = { type: 'none' };
  if (source.authType === 'header' && source.secretRef) {
    const secret = await projectSecretService.resolvePlaintext(source.secretRef);
    auth = { type: 'header', secret };
  }

  const headers = {};
  if (context?.principalType === 'ProjectRuntime' && context.externalUserId) {
    headers['X-Persona-External-User-Id'] = () => context.externalUserId;
  }

  return createRcpClient({ auth, headers, resolvers, logger });
}

/**
 * Builds `{ [param]: (ctx) => ctx?.turn?.[contextKey] }` from one source's
 * `paramContextMap` (dashboard-configured on the RcpSource itself, shared by
 * every agent that attaches it). Purely a static key-name mapping — the
 * actual per-turn value is read live, inside each tool's `func`, never here
 * (see `resolveRcpSourceTools`).
 */
function buildResolversFromParamContextMap(paramContextMap) {
  const resolvers = {};
  for (const { param, contextKey } of paramContextMap || []) {
    resolvers[param] = (ctx) => ctx?.turn?.[contextKey];
  }
  return resolvers;
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
 *
 * **Caching note (TURN_CONTEXT_RCP_RESOLVERS_PLAN.md):** this function only
 * runs on a `buildAgent()` cache miss — its result (including every
 * `DynamicStructuredTool` built here) is reused across every later turn from
 * the same caller. That's fine for the `resolvers` map itself (built from
 * static `paramContextMap` param names, never a value), but each tool's
 * `func` must never close over an actual per-turn `context` *value* — it
 * reads the live turn's data itself, at call time, via `getConfig()`.
 */
export async function resolveRcpSourceTools(agent, userId, context) {
  if (!agent.rcpSources || agent.rcpSources.length === 0) {
    return [];
  }

  const tools = [];
  for (const source of agent.rcpSources) {
    if (!source || source.isEnabled === false) continue;

    try {
      const resolvers = buildResolversFromParamContextMap(source.paramContextMap);
      const client = await buildClientFor(source, context, resolvers);
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
                  // `getConfig()` reads *this specific run's* per-invocation
                  // config (LangGraph's `configurable`), never something
                  // closed over when this tool was built — the tool object
                  // may be many turns old (cache hit), but this read always
                  // reflects the turn actually calling it right now. Same
                  // mechanism `contextOverrideMiddleware` uses for
                  // `contextOverride` (agent.factory.js).
                  const turn = getConfig()?.configurable?.turnContext;
                  const ctx = { execution: context, turn };
                  console.log(
                    `[RcpSource] "${source.name}" calling "${tool.name}" — paramContextMap:`,
                    JSON.stringify(source.paramContextMap),
                    'turn:',
                    JSON.stringify(turn),
                  );
                  const result = await client.call(tool, agentArgs, ctx);
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
