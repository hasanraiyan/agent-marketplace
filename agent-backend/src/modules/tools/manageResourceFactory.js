import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Free-form `{ [key]: any }` tool argument that every provider accepts.
 *
 * Deliberately NOT `z.record(z.string(), z.any())`: Zod 4 serialises that
 * with a `propertyNames` keyword, which Gemini's function-declaration
 * Schema (an OpenAPI 3.0 subset) rejects with `Unknown name
 * "propertyNames"` — the Architect worked on OpenAI but 400'd on Gemini.
 * `z.looseObject({})` is no better: it emits an OBJECT with empty
 * `properties`, which Gemini also refuses (see how @langchain/google-genai
 * drops `parameters` entirely for that case). A bare `{}` + description is
 * the one shape all providers take, so the object-only constraint lives in
 * a runtime `refine` instead of the JSON schema.
 */
export const freeformObjectArg = (description) =>
  z
    .any()
    .refine(isPlainObject, { message: 'must be a plain object' })
    .optional()
    .describe(description);

/**
 * Shared skeleton for the Architect's `manage_<resource>` tools
 * (manage_mcp, manage_rcp_source, manage_rest_api_tool, manage_skill —
 * manage_agent is bespoke, see builder.tools.js/projectBuilder.tools.js).
 *
 * Every resource service already follows the same shape (`create...`,
 * `get...ById`, `update...`, `delete...`, `discover...` — see mcp.service.js,
 * rcpSource.service.js, restApiTool.service.js, skill.service.js), so this
 * factory only owns the `action` dispatch + validation + JSON-formatting
 * that would otherwise be copy-pasted per resource. The actual service
 * calls are injected per resource (via `list`/`get`/`create`/`update`/
 * `remove`) rather than assumed by name, because Persona vs. Project
 * callers sometimes use genuinely different underlying methods (e.g. Mcp's
 * `getMyMcps(userId)` vs. `discoverMcps(context, ...)` — the latter has no
 * owner scoping and would leak cross-user data if used for a Persona
 * caller, see mcp.service.js's own docs on `_buildDeveloperDiscoveryFilter`).
 *
 * `identity` is `{ userId }` (Persona) or `{ context }` (Project/Developer)
 * — passed through untouched to whatever the resource's own service
 * methods expect, exactly like `projectBuilder.tools.js` already does.
 */
export function createManageResourceTool({
  name,
  description,
  actions = ['create', 'read', 'update', 'patch', 'delete'],
  patchableFields = {},
  list,
  get,
  create,
  update,
  remove,
}) {
  const has = (action) => actions.includes(action);

  return new DynamicStructuredTool({
    name,
    description,
    schema: z.object({
      action: z.enum(actions),
      id: z.string().optional().describe('Required for read (single), update, patch, delete.'),
      data: freeformObjectArg(
        'Object of fields to set, for create/update. Replaces named fields wholesale.'
      ),
      field: z.string().optional().describe('For patch: the single field to change.'),
      op: z
        .enum(['set', 'add', 'remove'])
        .optional()
        .describe('For patch: set a scalar, or add/remove one id from an array field.'),
      value: z.any().optional().describe('For patch: the value to set/add/remove.'),
      filters: freeformObjectArg('For read with no id: optional filters object (e.g. { search }).'),
    }),
    func: async (input) => {
      try {
        const { action } = input;
        if (!has(action)) {
          return JSON.stringify({
            status: 'error',
            message: `Action '${action}' is not supported by ${name}. Supported: ${actions.join(', ')}.`,
          });
        }

        switch (action) {
          case 'read': {
            if (input.id) {
              const item = await get(input.id);
              return JSON.stringify({ status: 'success', data: item });
            }
            const items = await list(input.filters || {});
            return JSON.stringify({ status: 'success', data: items });
          }

          case 'create': {
            if (!input.data) {
              return JSON.stringify({ status: 'error', message: '`data` is required to create.' });
            }
            const created = await create(input.data);
            return JSON.stringify({ status: 'success', message: 'Created.', data: created });
          }

          case 'update': {
            if (!input.id) {
              return JSON.stringify({ status: 'error', message: '`id` is required to update.' });
            }
            if (!input.data) {
              return JSON.stringify({ status: 'error', message: '`data` is required to update.' });
            }
            const updated = await update(input.id, input.data);
            return JSON.stringify({ status: 'success', message: 'Updated.', data: updated });
          }

          case 'patch': {
            const { id, field, op, value } = input;
            if (!id || !field || !op) {
              return JSON.stringify({
                status: 'error',
                message: '`id`, `field`, and `op` are required to patch.',
              });
            }
            const kind = patchableFields[field];
            if (!kind) {
              return JSON.stringify({
                status: 'error',
                message: `'${field}' is not a patchable field. Patchable fields: ${Object.keys(patchableFields).join(', ')}.`,
              });
            }
            if (kind === 'scalar' && op !== 'set') {
              return JSON.stringify({
                status: 'error',
                message: `'${field}' is a scalar field — only op:'set' is valid (not add/remove).`,
              });
            }

            let nextValue = value;
            if (kind === 'array') {
              const current = await get(id);
              const currentArray = Array.isArray(current?.[field]) ? current[field] : [];
              const currentIds = currentArray.map((v) =>
                v && typeof v === 'object' ? String(v._id ?? v.id ?? v) : String(v)
              );
              if (op === 'set') {
                nextValue = Array.isArray(value) ? value : [value];
              } else if (op === 'add') {
                nextValue = currentIds.includes(String(value))
                  ? currentIds
                  : [...currentIds, String(value)];
              } else if (op === 'remove') {
                nextValue = currentIds.filter((v) => v !== String(value));
              }
            }

            const updated = await update(id, { [field]: nextValue });
            return JSON.stringify({
              status: 'success',
              message: `Patched '${field}'.`,
              data: updated,
            });
          }

          case 'delete': {
            if (!input.id) {
              return JSON.stringify({ status: 'error', message: '`id` is required to delete.' });
            }
            await remove(input.id);
            return JSON.stringify({ status: 'success', message: 'Deleted.' });
          }

          default:
            return JSON.stringify({ status: 'error', message: `Unhandled action '${action}'.` });
        }
      } catch (err) {
        return JSON.stringify({ status: 'error', message: err.message });
      }
    },
  });
}
