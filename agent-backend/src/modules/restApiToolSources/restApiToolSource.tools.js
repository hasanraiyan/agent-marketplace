import { buildRestApiToolLangchainTool } from '../restApiTools/restApiTool.tools.js';
import { restToolManifestSchema } from './restApiToolSource.validator.js';
import projectSecretService from '../projects/projectSecret.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();
const FETCH_TIMEOUT_MS = 10000;

function slugifySourceName(name) {
  return (name || 'source')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Builds LangChain tools by fetching each attached+enabled
 * RestApiToolSource's manifest URL **live, on every call** — mirrors
 * `mcp.tools.js#resolveMcpTools`'s shape and resilience posture exactly: a
 * bad/unreachable/invalid source is logged and skipped, never thrown, so
 * one broken source never kills the whole agent run. The source's own
 * `tools[]` field (a dashboard-display cache written by Test Connection)
 * is never read here — same reason `resolveMcpTools` never reads `Mcp.tools`.
 *
 * Tool names are namespaced `${sourceSlug}__${toolSlug}` to avoid
 * collisions across multiple attached sources — same reasoning as MCP's
 * server-prefixed tool names.
 *
 * A tool declaring `authType: 'bearerSecret'` with no `secretRef` of its own
 * falls back to the source's own `secretRef` (the one secret picked once on
 * the REST Tool Source itself) — the caller's manifest never has to name a
 * Secret id at all, just declare that the call needs one.
 */
export async function resolveRestApiToolSourceTools(agent, userId, context) {
  if (!agent.restApiToolSources || agent.restApiToolSources.length === 0) {
    return [];
  }

  const tools = [];
  for (const source of agent.restApiToolSources) {
    if (source.isEnabled === false) continue;

    try {
      const headers = {};
      if (source.authType === 'apiKey' && source.secretRef) {
        const secretValue = await projectSecretService.resolvePlaintext(source.secretRef);
        headers.Authorization = `Bearer ${secretValue}`;
      }

      const res = await fetch(source.url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        logger.warn(
          `[RestApiToolSource] "${source.name}" manifest fetch failed with status ${res.status}`
        );
        continue;
      }

      let body;
      try {
        body = await res.json();
      } catch {
        logger.warn(`[RestApiToolSource] "${source.name}" manifest response was not valid JSON`);
        continue;
      }

      const parsed = restToolManifestSchema.safeParse(body);
      if (!parsed.success) {
        logger.warn(`[RestApiToolSource] "${source.name}" manifest failed validation`);
        continue;
      }

      const sourceSlug = slugifySourceName(source.name);
      for (const toolDef of parsed.data.tools) {
        try {
          let effectiveToolDef = toolDef;
          if (toolDef.authType === 'bearerSecret' && !toolDef.secretRef) {
            if (!source.secretRef) {
              logger.warn(
                `[RestApiToolSource] "${source.name}" tool "${toolDef.name}" declares bearerSecret ` +
                  'auth but neither the tool nor the source has a secret configured — skipping.'
              );
              continue;
            }
            effectiveToolDef = { ...toolDef, secretRef: source.secretRef };
          }
          tools.push(
            buildRestApiToolLangchainTool(
              { ...effectiveToolDef, name: `${sourceSlug}__${toolDef.name}` },
              context
            )
          );
        } catch (err) {
          logger.error(
            `[RestApiToolSource] "${source.name}" failed to build tool "${toolDef.name}": ${err?.message}`
          );
        }
      }
    } catch (err) {
      logger.error(`[RestApiToolSource] failed to load tools from "${source.name}": ${err?.message}`);
    }
  }

  return tools;
}
