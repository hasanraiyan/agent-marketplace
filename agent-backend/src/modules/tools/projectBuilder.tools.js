import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import agentService from '../agents/agent.service.js';
import providerRepository from '../providers/provider.repository.js';
import { createManageResourceTool } from './manageResourceFactory.js';
import skillService from '../skills/skill.service.js';
import { manageMcpTool } from './manageMcp.tools.js';
import { manageRcpSourceTool } from './manageRcpSource.tools.js';
import { manageRestApiToolTool } from './manageRestApiTool.tools.js';

/**
 * PROJECT AGENT ARCHITECT TOOLBOX (blueprint Phase 11.5, PR-62): a
 * dedicated, Project-scoped sibling of `builder.tools.js`'s Architect
 * toolbox — every tool closure takes a `ProjectAdminContext`/
 * `ProjectMachineContext`/`ProjectRuntimeContext` (not a bare Persona
 * `userId`) and calls the already-Project-aware service methods
 * (`createDeveloperAgent`/`discoverAgents`/`discoverSkills`/etc.).
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
 * manage_agent - full CRUD+patch over this Project's agents. Every Agent
 * this creates uses the Project's default Provider automatically — there's
 * nothing for the model to pick, unlike the Persona architect's
 * `providerId`/`modelName` fields (see the original `upsert_agent` comment
 * this preserves the reasoning from).
 */
export const manageAgentTool = (context) =>
  new DynamicStructuredTool({
    name: 'manage_agent',
    description:
      'CRUD for this Project\'s agents. action="create"|"read"|"update"|"patch"|"delete". `read` with no `id` lists this Project\'s agents; with `id` fetches one in full. `create`/`update` take `data` (name, description, systemPrompt, webSearchEnabled, avatar, tags, category, visibility, skills[], mcps[], restApiTools[], rcpSources[], knowledgeBases[], storeMounts[] — all attachment fields are arrays of ids and REPLACE the current list; this Project\'s default provider/model is always used automatically, never ask which to use). `patch` takes `id`, `field` (one of the attachment arrays above, or any scalar field), `op` ("set"|"add"|"remove" — add/remove only for the attachment arrays), and `value` — use patch to attach/detach ONE id (e.g. one MCP or RCP source) without resending the whole array.',
    schema: z.object({
      action: z.enum(['create', 'read', 'update', 'patch', 'delete']),
      id: z.string().optional().describe('Agent id. Required for read (single)/update/patch/delete.'),
      data: z
        .object({
          name: z.string().optional(),
          description: z.string().optional(),
          systemPrompt: z.string().optional(),
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
              const agent = await agentService.getDeveloperAgentById(input.id, context);
              return JSON.stringify({ status: 'success', data: agent });
            }
            const agents = await agentService.discoverAgents(context, {}, { page: 1, limit: 100 });
            return JSON.stringify({ status: 'success', data: agents.map(summarizeAgent) });
          }

          case 'update': {
            if (!input.id) {
              return JSON.stringify({ status: 'error', message: '`id` is required to update.' });
            }
            if (!input.data) {
              return JSON.stringify({ status: 'error', message: '`data` is required.' });
            }
            const sanitized = { ...input.data };
            if (sanitized.description === '') delete sanitized.description;
            if (sanitized.avatar === '') delete sanitized.avatar;
            const updated = await agentService.updateAgent(input.id, undefined, sanitized, context);
            const data = normalizeAgentPayload(updated);
            return JSON.stringify({
              status: 'success',
              message: `Successfully updated agent: ${updated.name}`,
              agentId: data.id,
              data,
            });
          }

          case 'create': {
            if (!input.data) {
              return JSON.stringify({ status: 'error', message: '`data` is required.' });
            }
            const sanitized = { ...input.data };
            if (sanitized.description === '') delete sanitized.description;
            if (sanitized.avatar === '') delete sanitized.avatar;
            if (!sanitized.name || !sanitized.systemPrompt) {
              return JSON.stringify({
                status: 'error',
                message: 'name and systemPrompt are required to create a new agent.',
              });
            }

            const domainProviders = await providerRepository.findByDomain(context.domain);
            const defaultProvider = domainProviders.find((p) => p.isDefault) || domainProviders[0];
            if (!defaultProvider) {
              return JSON.stringify({
                status: 'error',
                message:
                  'No LLM provider is configured for this Project yet — add one from the Providers tab first.',
              });
            }
            sanitized.providerId = defaultProvider._id;

            const created = await agentService.createDeveloperAgent(context, sanitized);
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
            const current = await agentService.getDeveloperAgentById(id, context);
            const currentIds = (Array.isArray(current?.[field]) ? current[field] : []).map((v) =>
              v && typeof v === 'object' ? String(v._id ?? v.id ?? v) : String(v)
            );
            let nextValue;
            if (op === 'set') {
              nextValue = Array.isArray(value) ? value : [value];
            } else if (op === 'add') {
              nextValue = currentIds.includes(String(value)) ? currentIds : [...currentIds, String(value)];
            } else {
              nextValue = currentIds.filter((v) => v !== String(value));
            }
            const updated = await agentService.updateAgent(id, undefined, { [field]: nextValue }, context);
            const data = normalizeAgentPayload(updated);
            return JSON.stringify({ status: 'success', message: `Patched '${field}'.`, agentId: data.id, data });
          }

          case 'delete': {
            if (!input.id) {
              return JSON.stringify({ status: 'error', message: '`id` is required to delete.' });
            }
            await agentService.deleteAgent(input.id, undefined, context);
            return JSON.stringify({ status: 'success', message: 'Agent deleted successfully.' });
          }

          default:
            return JSON.stringify({ status: 'error', message: `Unhandled action '${input.action}'.` });
        }
      } catch (err) {
        return JSON.stringify({ status: 'error', message: `Error managing agent: ${err.message}` });
      }
    },
  });

/**
 * manage_skill - read/update/delete for this Project's skills, reusing the
 * Discovery Contract (`discoverSkills`) for `list` — consistent with how
 * the read-only Studio Skills tab already shows every Skill in this
 * Project's own Domain, any owner type. No `create`: skill content is only
 * authored via the /skill-library/ filesystem route.
 */
export const manageSkillTool = (context) =>
  createManageResourceTool({
    name: 'manage_skill',
    description:
      "Read/update/delete for this Project's skills. `read` with no `id` lists them (with ids for attaching); with `id` fetches one. `update` (data: {isPublic}) toggles marketplace visibility. To CREATE or EDIT skill content, write files under /skill-library/<skill-name>/ instead — not this tool.",
    actions: ['read', 'update', 'delete'],
    patchableFields: {},
    list: async (filters) => {
      const skills = await skillService.discoverSkills(context, filters, { page: 1, limit: 100 });
      return skills.map((s) => ({
        id: s._id,
        name: s.name,
        description: s.description,
        isPublic: s.isPublic,
      }));
    },
    get: async (id) => skillService.getSkillById(id, undefined, context),
    update: async (id, data) => skillService.updateSkill(id, undefined, data, context),
    remove: async (id) => skillService.deleteSkill(id, undefined, context),
  });

/**
 * Factory for all Project Agent Architect tools, injected with a
 * `ProjectAdminContext`/`ProjectMachineContext`/`ProjectRuntimeContext`
 * instead of a bare Persona `userId`.
 */
export const getProjectBuilderToolbox = (context) => [
  manageAgentTool(context),
  manageSkillTool(context),
  manageMcpTool({ context }),
  manageRcpSourceTool({ context }),
  manageRestApiToolTool({ context }),
];
