import { z } from 'zod';

/**
 * Documented, versioned catalog of the custom AG-UI `CUSTOM` events this
 * backend emits (see aguiTranslator.js's `EventType.CUSTOM` yield sites),
 * backing `GET /api/v1/developer/agui/schema`. Adding a new custom event or
 * changing an existing payload shape here should bump AGUI_SCHEMA_VERSION.
 */

const clarificationQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  options: z.array(z.string()),
  required: z.boolean(),
  allowCustom: z.boolean(),
});

// aguiTranslator.js: buildClarificationCustomEvent
export const clarificationRequestSchema = z.object({
  questions: z.array(clarificationQuestionSchema),
  currentIndex: z.number().int(),
});

// aguiTranslator.js: hitl_request yield sites (lines ~947, ~1007). Payload
// shapes are opaque langchain humanInTheLoopMiddleware structures, passed
// through as-is.
export const hitlRequestSchema = z.object({
  actionRequests: z.array(z.unknown()),
  reviewConfigs: z.array(z.unknown()),
});

// aguiTranslator.js: mcp_app yield site (on_tool_start, ~line 821) — fired
// when an MCP-registered tool declares a widget via _meta.ui.resourceUri.
export const mcpAppSchema = z.object({
  toolCallId: z.string(),
  resourceUri: z.string(),
  mcpId: z.string(),
});

// aguiTranslator.js: subagent_activity yield sites (nested model text,
// nested tool start, nested tool result/error) — discriminated by `kind`.
const subagentActivityTextSchema = z.object({
  toolCallId: z.string(),
  kind: z.literal('text'),
  delta: z.string(),
});
const subagentActivityToolStartSchema = z.object({
  toolCallId: z.string(),
  kind: z.literal('tool_start'),
  toolName: z.string(),
  args: z.string(),
});
const subagentActivityToolResultSchema = z.object({
  toolCallId: z.string(),
  kind: z.literal('tool_result'),
  toolName: z.string(),
  result: z.string(),
});
export const subagentActivitySchema = z.union([
  subagentActivityTextSchema,
  subagentActivityToolStartSchema,
  subagentActivityToolResultSchema,
]);

export const AGUI_SCHEMA_VERSION = '1.0.0';

const AGUI_CUSTOM_EVENTS = [
  {
    type: 'clarification_request',
    description: 'Pauses the run pending free-text/multiple-choice clarification from the user.',
    schema: clarificationRequestSchema,
  },
  {
    type: 'hitl_request',
    description:
      "Pauses the run pending human approval of one or more pending tool calls (an Agent's interruptOn config).",
    schema: hitlRequestSchema,
  },
  {
    type: 'mcp_app',
    description:
      'Signals an MCP-registered tool call that declares an interactive widget via _meta.ui.resourceUri.',
    schema: mcpAppSchema,
  },
  {
    type: 'subagent_activity',
    description:
      "Streams a nested subagent (deepagents 'task' tool) invocation's text/tool activity, discriminated by kind.",
    schema: subagentActivitySchema,
  },
];

function toPascalCase(snakeCase) {
  return snakeCase
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function buildAguiSchemaDocument() {
  const definitions = {};
  const events = AGUI_CUSTOM_EVENTS.map(({ type, description, schema }) => {
    const definitionName = `${toPascalCase(type)}Payload`;
    definitions[definitionName] = z.toJSONSchema(schema);
    return {
      type,
      description,
      payloadSchema: { $ref: `#/definitions/${definitionName}` },
    };
  });

  return {
    schemaVersion: AGUI_SCHEMA_VERSION,
    baseProtocol: '@ag-ui/core@0.0.57',
    events,
    definitions,
  };
}
