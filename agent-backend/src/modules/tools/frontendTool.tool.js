import crypto from 'crypto';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { interrupt } from '@langchain/langgraph';

/**
 * Frontend tools — tools the embedding client app supplies per run (AG-UI
 * `RunAgentInput.tools`: `{ name, description, parameters }`, registered via
 * `@personaai/react`'s useFrontendTool & co.) that execute in the end user's
 * browser, not here.
 *
 * Interrupt-based (same mechanism as clarification.tool.js): the stub tool
 * pauses the graph with `interrupt({ kind: 'frontend_tool', ... })`, the
 * client runs the tool and resumes the thread with
 * `resume: { toolResults: [{ toolCallId, result?, error? }] }`, and
 * `interrupt()` returns that answer as this tool's return value. The pause
 * lives in the checkpoint, so a refresh/closed tab can't strand a dangling
 * tool call — the next request resumes it (see buildResumeValue).
 *
 * Only built when the Agent has `frontendToolsEnabled`, only for the main
 * agent (never subagents), and never overriding a server tool's name.
 */

export const FRONTEND_TOOL_LIMITS = Object.freeze({
  maxTools: 20,
  maxDescriptionLength: 1024,
  maxSchemaBytes: 8 * 1024,
});

const NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

// deepagents' built-in tools are added by middleware, not the resolved tool
// list, so they're reserved here explicitly.
export const RESERVED_TOOL_NAMES = Object.freeze([
  'write_todos',
  'ls',
  'read_file',
  'write_file',
  'edit_file',
  'glob',
  'grep',
  'execute',
  'task',
]);

const EMPTY_OBJECT_SCHEMA = Object.freeze({ type: 'object', properties: {} });

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate + normalize client-supplied tool definitions. Never throws: an
 * invalid entry is dropped (and reported) so one bad tool can't break chat.
 *
 * @param {unknown} raw - `input.tools` from the request body
 * @param {{ reservedNames?: Iterable<string> }} [opts]
 * @returns {{ tools: {name: string, description: string, parameters: object}[], dropped: {name: string, reason: string}[] }}
 */
export function normalizeFrontendTools(raw, { reservedNames = [] } = {}) {
  const tools = [];
  const dropped = [];
  if (!Array.isArray(raw)) return { tools, dropped };

  const reserved = new Set([...RESERVED_TOOL_NAMES, ...reservedNames]);
  const seen = new Set();

  for (const entry of raw) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const drop = (reason) => dropped.push({ name: name || '(unnamed)', reason });

    if (!NAME_PATTERN.test(name)) {
      drop('invalid name');
      continue;
    }
    if (seen.has(name)) {
      drop('duplicate name');
      continue;
    }
    if (reserved.has(name)) {
      drop('name clashes with a server tool');
      continue;
    }
    if (tools.length >= FRONTEND_TOOL_LIMITS.maxTools) {
      drop('too many tools');
      continue;
    }

    const parameters = entry.parameters == null ? EMPTY_OBJECT_SCHEMA : entry.parameters;
    if (!isPlainObject(parameters) || (parameters.type != null && parameters.type !== 'object')) {
      drop('parameters must be a JSON Schema object');
      continue;
    }
    let schemaJson;
    try {
      schemaJson = JSON.stringify(parameters);
    } catch {
      drop('parameters not serializable');
      continue;
    }
    if (Buffer.byteLength(schemaJson, 'utf8') > FRONTEND_TOOL_LIMITS.maxSchemaBytes) {
      drop('parameters schema too large');
      continue;
    }

    const description =
      typeof entry.description === 'string' && entry.description.trim()
        ? entry.description.trim().slice(0, FRONTEND_TOOL_LIMITS.maxDescriptionLength)
        : `Client-side tool "${name}".`;

    seen.add(name);
    tools.push({
      name,
      description,
      // Re-parsed copy: detached from the request object, `type` guaranteed.
      parameters: { ...JSON.parse(schemaJson), type: 'object' },
    });
  }

  return { tools, dropped };
}

/**
 * Stable short hash of normalized definitions — part of the compiled-agent
 * cache key, since the graph's tool set now varies per client.
 */
export function hashFrontendTools(tools) {
  if (!tools?.length) return '';
  return crypto.createHash('sha256').update(JSON.stringify(tools)).digest('hex').slice(0, 16);
}

/**
 * Turns the client's answer (the value `interrupt()` returns) into the
 * tool's string result. `{ error }` becomes the same error envelope as a
 * failed server tool (`{status:'error', message}`), so clients' error
 * detection and the model's recovery behave identically.
 */
export function formatFrontendToolResult(response) {
  if (isPlainObject(response) && response.error != null) {
    return JSON.stringify({ status: 'error', message: String(response.error) });
  }
  const result = isPlainObject(response) && 'result' in response ? response.result : response;
  if (result === undefined || result === null) return 'Done.';
  return typeof result === 'string' ? result : JSON.stringify(result);
}

/** One stub tool per definition: pauses the run until the browser answers. */
export function createFrontendTool({ name, description, parameters }) {
  return new DynamicStructuredTool({
    name,
    description,
    schema: parameters,
    metadata: { frontendTool: true },
    func: async (args, _runManager, config) => {
      const response = interrupt({
        kind: 'frontend_tool',
        toolCallId: config?.toolCall?.id ?? null,
        name,
        args: args ?? {},
      });
      return formatFrontendToolResult(response);
    },
  });
}
