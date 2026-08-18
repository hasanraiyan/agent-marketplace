import { DynamicStructuredTool } from '@langchain/core/tools';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Gemini's function-calling API only accepts a restricted OpenAPI-3.0-style
 * schema subset, not full JSON Schema — it 400s the ENTIRE request (every
 * tool in the call, not just the offending one) if any tool schema contains
 * a keyword it doesn't recognize. Zod v4's schema conversion emits
 * `exclusiveMinimum`/`exclusiveMaximum` (numeric-value form, JSON Schema
 * 2020-12) for constraints like `.positive()`/`.gt()`, which Gemini rejects
 * outright: @langchain/google-genai@2.2.0's own sanitizer
 * (removeAdditionalProperties) strips `additionalProperties`/`$schema`/
 * `strict` but not this — a real, currently-unfixed gap in the library
 * (confirmed: no newer stable release changes this).
 *
 * Recursively rewrites those two keywords to their inclusive equivalents
 * (`minimum`/`maximum`) — an approximation (loses the "strictly greater
 * than" semantics for the LLM's own guidance), but the tool's real argument
 * validation is untouched by this (see sanitizeToolsForGemini below), so a
 * value that should have been rejected still is once the tool actually runs.
 */
function sanitizeSchemaForGemini(schema) {
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForGemini);
  if (schema === null || typeof schema !== 'object') return schema;

  const next = { ...schema };
  if (typeof next.exclusiveMinimum === 'number') {
    next.minimum = next.exclusiveMinimum;
    delete next.exclusiveMinimum;
  }
  if (typeof next.exclusiveMaximum === 'number') {
    next.maximum = next.exclusiveMaximum;
    delete next.exclusiveMaximum;
  }
  for (const key of Object.keys(next)) {
    if (next[key] && typeof next[key] === 'object') {
      next[key] = sanitizeSchemaForGemini(next[key]);
    }
  }
  return next;
}

/**
 * Rebuilds every tool with its Zod schema pre-converted to a sanitized JSON
 * Schema, for every tool source alike (this repo's own built-in tools and
 * MCP-sourced ones — both hit the same Gemini 400, so both need this).
 *
 * Doesn't touch @langchain/google-genai's internals: LangChain tools
 * natively accept either a Zod schema or a plain JSON Schema as `.schema`
 * (`ToolInputSchemaBase = InteropZodType | JsonSchema7Type`, a first-class,
 * documented @langchain/core type) — @langchain/google-genai's own
 * conversion (schemaToGenerativeAIParameters) only calls Zod->JSON
 * conversion when it sees a Zod schema; a plain JSON Schema object is used
 * as-is. Giving it an already-sanitized JSON Schema means Gemini simply
 * never sees the keyword it 400s on. Tool-call argument validation still
 * runs against this same schema at call time (LangChain validates
 * JsonSchema7Type tool schemas natively), so a value real @langchain/core
 * would have rejected still is — only the *declaration* sent to Gemini
 * changes, not what's accepted when the tool actually runs.
 */
export function sanitizeToolsForGemini(tools) {
  return tools.map((tool) => {
    if (!tool?.schema) return tool;
    try {
      const schema = sanitizeSchemaForGemini(toJsonSchema(tool.schema));
      return new DynamicStructuredTool({
        name: tool.name,
        description: tool.description,
        schema,
        func: (...args) => tool.func(...args),
      });
    } catch (error) {
      logger.warn(`[AgentFactory] Could not sanitize tool "${tool.name}" for Gemini:`, {
        error: error?.message || error,
      });
      return tool;
    }
  });
}
