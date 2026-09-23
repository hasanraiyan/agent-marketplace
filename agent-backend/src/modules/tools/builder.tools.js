import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import agentService from '../agents/agent.service.js';
import providerRepository from '../providers/provider.repository.js';
import { createManageResourceTool } from './manageResourceFactory.js';
import skillService from '../skills/skill.service.js';
import { manageMcpTool } from './manageMcp.tools.js';

/**
 * ARCHITECT TOOLBOX:
 * A specialized set of tools that allow an LLM to build and manage agents,
 * skills, and MCP connectors.
 */

/**
 * list_my_providers - Allows the architect to see what engines are available.
 * STRICTLY STRIPS API KEYS.
 */
export const listProvidersTool = (userId) =>
  new DynamicStructuredTool({
    name: 'list_my_providers',
    description:
      'Lists all LLM providers (base URLs, default models) configured by the user. Use this to help the user choose a model for their agent. Sensitive keys are NOT included.',
    schema: z.object({}),
    func: async () => {
      try {
        const providers = await providerRepository.findByUser(userId);
        return JSON.stringify({
          status: 'success',
          data: providers.map((p) => ({
            id: p._id,
            label: p.label,
            baseURL: p.baseURL,
            defaultModel: p.defaultModel,
          })),
        });
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: err.message,
        });
      }
    },
  });

/**
 * Normalizes an agent document for tool output so clients can rely on both
 * `id` and `_id` being present regardless of Mongoose serialization.
 */
const normalizeAgentPayload = (agent) => {
  if (!agent) return agent;
  const plain = typeof agent.toObject === 'function' ? agent.toObject() : { ...agent };
  const id = plain._id ?? plain.id;
  if (id != null) {
    plain.id = id.toString();
    plain._id = id.toString();
  }
  return plain;
};

const AGENT_ARRAY_FIELDS = [
  'skills',
  'mcps',
  'restApiTools',
  'rcpSources',
  'knowledgeBases',
  'storeMounts',
];

const summarizeAgent = (a) => ({
  id: a._id ?? a.id,
  name: a.name,
  description: a.description,
  visibility: a.visibility,
});

/**
 * manage_agent - full CRUD+patch over the user's own agents, including
 * attaching skills/mcps/restApiTools/rcpSources/knowledgeBases/storeMounts.
 * `update` replaces named fields wholesale; `patch` does a targeted
 * add/remove/set on ONE field (mainly the attachment arrays above), so the
 * model can attach one MCP without re-sending the agent's whole current
 * attachment list. `restApiToolSources` is deliberately not attachable here
 * — it's superseded by `rcpSources` (manage_rcp_source is Project-only, see
 * projectBuilder.tools.js, since RcpSource has no Persona route yet).
 */
export const manageAgentTool = (userId) =>
  new DynamicStructuredTool({
    name: 'manage_agent',
    description:
      'CRUD for the agents you own. action="create"|"read"|"update"|"patch"|"delete". `read` with no `id` lists your agents; with `id` fetches one in full. `create`/`update` take `data` (name, description, systemPrompt, providerId, modelName, webSearchEnabled, avatar, tags, category, visibility, skills[], mcps[], restApiTools[], rcpSources[], knowledgeBases[], storeMounts[] — all attachment fields are arrays of ids and REPLACE the current list). `patch` takes `id`, `field` (one of the attachment arrays above, or any scalar field), `op` ("set"|"add"|"remove" — add/remove only for the attachment arrays), and `value` — use patch to attach/detach ONE id without resending the whole array.',
    schema: z.object({
      action: z.enum(['create', 'read', 'update', 'patch', 'delete']),
      id: z
        .string()
        .optional()
        .describe('Agent id. Required for read (single)/update/patch/delete.'),
      data: z
        .object({
          name: z.string().optional(),
          description: z.string().optional(),
          systemPrompt: z.string().optional(),
          providerId: z.string().optional(),
          modelName: z.string().optional(),
          webSearchEnabled: z.boolean().optional(),
          avatar: z.string().optional(),
          tags: z.array(z.string()).optional(),
          category: z
            .enum(['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'])
            .optional(),
          visibility: z.enum(['private', 'unlisted', 'public']).optional(),
          skills: z.array(z.string()).optional(),
          mcps: z.array(z.string()).optional(),
          restApiTools: z.array(z.string()).optional(),
          rcpSources: z.array(z.string()).optional(),
          knowledgeBases: z.array(z.string()).optional(),
          storeMounts: z.array(z.string()).optional(),
        })
        .optional(),
      field: z.enum(AGENT_ARRAY_FIELDS).optional().describe('For patch: which field to change.'),
      op: z.enum(['set', 'add', 'remove']).optional(),
      value: z.any().optional(),
    }),
    func: async (input) => {
      try {
        switch (input.action) {
          case 'read': {
            if (input.id) {
              const agent = await agentService.getAgentById(input.id, userId);
              return JSON.stringify({ status: 'success', data: agent });
            }
            const agents = await agentService.searchAgents({ ownerId: userId }, {}, userId);
            return JSON.stringify({ status: 'success', data: agents.map(summarizeAgent) });
          }

          case 'create':
          case 'update': {
            if (!input.data) {
              return JSON.stringify({ status: 'error', message: '`data` is required.' });
            }
            const sanitized = { ...input.data };
            if (sanitized.description === '') delete sanitized.description;
            if (sanitized.avatar === '') delete sanitized.avatar;
            if (sanitized.modelName === '') delete sanitized.modelName;

            if (sanitized.providerId) {
              const provider = await providerRepository.findById(sanitized.providerId);
              if (!provider || provider.ownerId.toString() !== userId.toString()) {
                return JSON.stringify({
                  status: 'error',
                  message: 'Invalid providerId or unauthorized.',
                });
              }
            }

            if (input.action === 'update') {
              if (!input.id) {
                return JSON.stringify({ status: 'error', message: '`id` is required to update.' });
              }
              const updated = await agentService.updateAgent(input.id, userId, sanitized);
              const data = normalizeAgentPayload(updated);
              return JSON.stringify({
                status: 'success',
                message: `Successfully updated agent: ${updated.name}`,
                agentId: data.id,
                data,
              });
            }

            if (!sanitized.name || !sanitized.systemPrompt || !sanitized.providerId) {
              return JSON.stringify({
                status: 'error',
                message: 'name, systemPrompt, and providerId are required to create a new agent.',
              });
            }
            const created = await agentService.createAgent(userId, sanitized);
            const data = normalizeAgentPayload(created);
            return JSON.stringify({
              status: 'success',
              message: `Successfully created new agent: ${created.name}`,
              agentId: data.id,
              data,
            });
          }

          case 'patch': {
            const { id, field, op, value } = input;
            if (!id || !field || !op) {
              return JSON.stringify({
                status: 'error',
                message: '`id`, `field`, and `op` are required to patch.',
              });
            }
            const current = await agentService.getAgentById(id, userId);
            const currentIds = (Array.isArray(current?.[field]) ? current[field] : []).map((v) =>
              v && typeof v === 'object' ? String(v._id ?? v.id ?? v) : String(v)
            );
            let nextValue;
            if (op === 'set') {
              nextValue = Array.isArray(value) ? value : [value];
            } else if (op === 'add') {
              nextValue = currentIds.includes(String(value))
                ? currentIds
                : [...currentIds, String(value)];
            } else {
              nextValue = currentIds.filter((v) => v !== String(value));
            }
            const updated = await agentService.updateAgent(id, userId, { [field]: nextValue });
            const data = normalizeAgentPayload(updated);
            return JSON.stringify({
              status: 'success',
              message: `Patched '${field}'.`,
              agentId: data.id,
              data,
            });
          }

          case 'delete': {
            if (!input.id) {
              return JSON.stringify({ status: 'error', message: '`id` is required to delete.' });
            }
            await agentService.deleteAgent(input.id, userId);
            return JSON.stringify({ status: 'success', message: 'Agent deleted successfully.' });
          }

          default:
            return JSON.stringify({
              status: 'error',
              message: `Unhandled action '${input.action}'.`,
            });
        }
      } catch (err) {
        return JSON.stringify({ status: 'error', message: `Error managing agent: ${err.message}` });
      }
    },
  });

/**
 * manage_skill - read/update/delete for the user's own skills (list them
 * with ids for attaching, toggle marketplace visibility, or delete one).
 * No `create`/`patch`: skill CONTENT is authored via the /skill-library/
 * filesystem route (write_file/edit_file on SKILL.md and supporting
 * files), which already creates the Skill doc on first write.
 */
export const manageSkillTool = (userId) =>
  createManageResourceTool({
    name: 'manage_skill',
    description:
      'Read/update/delete for your skills. `read` with no `id` lists them (with ids for attaching to agents); with `id` fetches one. `update` (data: {isPublic}) toggles marketplace visibility. To CREATE or EDIT skill content, write files under /skill-library/<skill-name>/ instead (SKILL.md with YAML frontmatter + optional references/ files) — not this tool.',
    actions: ['read', 'update', 'delete'],
    patchableFields: {},
    list: async () => {
      const skills = await skillService.getMySkills(userId);
      return skills.map((s) => ({
        id: s._id,
        name: s.name,
        description: s.description,
        isPublic: s.isPublic,
        fileCount: (s.files?.length || 0) + 1,
      }));
    },
    get: async (id) => skillService.getSkillById(id, userId),
    update: async (id, data) => skillService.updateSkill(id, userId, data),
    remove: async (id) => skillService.deleteSkill(id, userId),
  });

/**
 * get_builder_toolbox - Factory for all architect tools injected with contextual userId
 */
export const getBuilderToolbox = (userId) => [
  listProvidersTool(userId),
  manageAgentTool(userId),
  manageSkillTool(userId),
  manageMcpTool({ userId }),
];
