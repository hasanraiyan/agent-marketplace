import { z } from 'zod';

/**
 * Template engine for the REST API Tool Builder
 * (PERSONA_REST_TOOL_REQUEST.md item 1): renders `{{tokenName}}`
 * placeholders in a RestApiTool's url/queryParams/headers/bodyTemplate.
 *
 * The whole point of this module is that `externalUserId` can NEVER be
 * supplied or overridden by the calling LLM:
 *   1. `buildArgsSchema` never includes it in the agent-facing zod schema —
 *      LangChain's own arg validation strips/rejects any such key from a
 *      tool call before `func` ever runs.
 *   2. `renderTool` never reads `agentArgs.externalUserId` under any
 *      circumstance — its value is sourced from a single, fixed branch
 *      keyed off the execution `context`, never a generic
 *      name-indexed lookup into agent-supplied data.
 *   3. A context with no asserted external user (e.g. a ProjectMachine or
 *      ProjectAdmin test call) causes `renderTool` to throw
 *      `ReservedTokenUnresolvedError` BEFORE any HTTP request is
 *      constructed — never a silent empty-string substitution.
 */

// v1 has exactly one reserved token; the array shape is deliberate so a
// future reserved token (e.g. a projectDomain) is a pure addition here,
// not a rewrite of every call site.
export const RESERVED_TEMPLATE_TOKENS = Object.freeze(['externalUserId']);

export class ReservedTokenUnresolvedError extends Error {}
export class MissingTemplateValueError extends Error {}

const TOKEN_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** Every `{{name}}` occurrence in a string, in order, with duplicates. */
export function extractTokenNames(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const names = [];
  let match;
  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Scans every templated field of a RestApiTool-shaped object and splits
 * the token names found into reserved vs. agent-fillable. Classification
 * is name-based against RESERVED_TEMPLATE_TOKENS — NOT based on which
 * field the token appears in — so `{{externalUserId}}` is reserved no
 * matter whether it's typed into the URL, a header, a query param, or the
 * body.
 */
export function collectTemplateTokens(tool) {
  const texts = [
    tool?.url,
    ...(tool?.queryParams || []).map((p) => p.valueTemplate),
    ...(tool?.headers || []).map((h) => h.valueTemplate),
    tool?.bodyMode === 'json' ? tool?.bodyTemplate : null,
  ];

  const reservedTokens = [];
  const agentTokens = [];
  const seenReserved = new Set();
  const seenAgent = new Set();

  for (const text of texts) {
    for (const name of extractTokenNames(text)) {
      if (RESERVED_TEMPLATE_TOKENS.includes(name)) {
        if (!seenReserved.has(name)) {
          seenReserved.add(name);
          reservedTokens.push(name);
        }
      } else if (!seenAgent.has(name)) {
        seenAgent.add(name);
        agentTokens.push(name);
      }
    }
  }

  return { reservedTokens, agentTokens };
}

function zodTypeFor(type) {
  if (type === 'number') return z.number();
  if (type === 'boolean') return z.boolean();
  return z.string();
}

/**
 * Builds the zod schema for the LangChain tool's agent-facing args, from
 * `agentTokens` only. A second, independent guard skips any name in
 * RESERVED_TEMPLATE_TOKENS even if it somehow made it into
 * `paramDescriptors` (e.g. a raw doc mutated outside the normal save
 * path) — this function alone is a sufficient boundary even if
 * `restApiTool.service.js`'s save-time validation were ever bypassed.
 */
export function buildArgsSchema(tool) {
  const { agentTokens } = collectTemplateTokens(tool);
  const shape = {};

  for (const name of agentTokens) {
    if (RESERVED_TEMPLATE_TOKENS.includes(name)) continue;

    const descriptor = (tool?.paramDescriptors || []).find((p) => p.name === name);
    let field = zodTypeFor(descriptor?.type);
    if (descriptor?.description) field = field.describe(descriptor.description);
    shape[name] = descriptor?.required === false ? field.optional() : field;
  }

  return z.object(shape);
}

/**
 * Renders one templated string. `resolvedValues` must have an entry (even
 * `undefined`) for every token name that appears in `text` — a token with
 * no entry at all is a structural bug in the caller (`renderTool` below
 * always populates every token it found via `collectTemplateTokens`
 * before calling this), not a legitimate "missing value" case, so it
 * throws `MissingTemplateValueError` rather than silently rendering an
 * empty string.
 *
 * A token listed in `requiredTokenNames` whose resolved value is
 * null/undefined also throws `MissingTemplateValueError` — an optional
 * agent-fillable token that's simply absent renders as `''`.
 */
export function renderTemplate(text, resolvedValues, requiredTokenNames) {
  if (typeof text !== 'string' || text.length === 0) return text || '';

  return text.replace(TOKEN_PATTERN, (_match, name) => {
    if (!Object.prototype.hasOwnProperty.call(resolvedValues, name)) {
      throw new MissingTemplateValueError(
        `Template references {{${name}}}, but no value was resolved for it.`
      );
    }
    const value = resolvedValues[name];
    if ((value === undefined || value === null) && requiredTokenNames.has(name)) {
      throw new MissingTemplateValueError(`A value is required for {{${name}}}, but none was supplied.`);
    }
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * Renders every templated field of a tool for one invocation.
 *   agentArgs: the already-zod-validated object the model supplied
 *   context: the execution context (ProjectRuntime/ProjectMachine/ProjectAdmin/PersonaUser)
 * Returns { url, queryParams: Record<string,string>, headers: Record<string,string>, body: string|null }
 */
export function renderTool(tool, { agentArgs = {}, context } = {}) {
  const { reservedTokens, agentTokens } = collectTemplateTokens(tool);
  const resolvedValues = {};
  const requiredTokenNames = new Set();

  for (const name of reservedTokens) {
    // Fixed, separate branch per reserved token name — never a generic
    // fallback that could accidentally source a reserved value from
    // agentArgs. A reserved token is never "optional" if referenced.
    requiredTokenNames.add(name);
    if (name === 'externalUserId') {
      if (context?.principalType === 'ProjectRuntime' && context.externalUserId) {
        resolvedValues.externalUserId = context.externalUserId;
      } else {
        throw new ReservedTokenUnresolvedError(
          `This tool uses {{externalUserId}}, but the calling context has no asserted external ` +
            `user (principalType: ${context?.principalType ?? 'unknown'}). This call was made ` +
            `outside of an end-user session — the request was not sent.`
        );
      }
    }
  }

  for (const name of agentTokens) {
    // Structurally cannot be "externalUserId" — that name was excluded
    // from agentTokens by collectTemplateTokens's reserved-name check.
    const descriptor = (tool?.paramDescriptors || []).find((p) => p.name === name);
    if (descriptor?.required !== false) requiredTokenNames.add(name);
    resolvedValues[name] = agentArgs?.[name];
  }

  const renderedUrl = renderTemplate(tool.url, resolvedValues, requiredTokenNames);

  const queryParams = {};
  for (const qp of tool.queryParams || []) {
    queryParams[qp.key] = renderTemplate(qp.valueTemplate, resolvedValues, requiredTokenNames);
  }

  const headers = {};
  for (const h of tool.headers || []) {
    headers[h.key] = renderTemplate(h.valueTemplate, resolvedValues, requiredTokenNames);
  }

  const body =
    tool.bodyMode === 'json' && tool.bodyTemplate
      ? renderTemplate(tool.bodyTemplate, resolvedValues, requiredTokenNames)
      : null;

  return { url: renderedUrl, queryParams, headers, body };
}
