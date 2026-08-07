import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import agentService from '../agents/agent.service.js';
import skillService from '../skills/skill.service.js';
import providerRepository from '../providers/provider.repository.js';

/**
 * PROJECT AGENT ARCHITECT TOOLBOX (blueprint Phase 11.5, PR-62):
 * a dedicated, Project-scoped sibling of `builder.tools.js`'s Architect
 * toolbox — same 6 tools, same shape, but every tool closure takes a
 * `ProjectAdminContext` (not a bare Persona `userId`) and calls the
 * already-Project-aware service methods (`createDeveloperAgent`/
 * `discoverAgents`/`discoverSkills`/etc.) instead of the Persona-onboarding-
 * shaped ones `builder.tools.js` uses. Built fresh rather than
 * parameterizing `builder.tools.js` itself, per this initiative's decision
 * to keep the live, heavily-used Persona Architect untouched.
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

export const upsertAgentTool = (context) =>
  new DynamicStructuredTool({
    name: 'upsert_agent',
    description:
      'Creates or updates an Agent owned by this Project. Handles basic info, instructions, and runtime settings.',
    schema: z.object({
      agentId: z
        .string()
        .optional()
        .describe('ID of the agent to update. Leave empty to create a new one.'),
      name: z.string().optional().describe('Name of the agent'),
      description: z.string().optional().describe('Brief summary of what the agent does'),
      systemPrompt: z
        .string()
        .optional()
        .describe('The primary instructions defining the agent behavior'),
      webSearchEnabled: z.boolean().optional().describe('Toggle for web search capability'),
      avatar: z.string().optional().describe('URL to the agent avatar image'),
      tags: z.array(z.string()).optional().describe('Tags for categorization and search'),
      category: z
        .enum(['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'])
        .optional(),
      visibility: z.enum(['private', 'unlisted', 'public']).optional(),
      skills: z.array(z.string()).optional().describe('Array of Skill IDs to link to this agent'),
    }),
    func: async (input) => {
      try {
        const sanitized = { ...input };
        if (sanitized.description === '') delete sanitized.description;
        if (sanitized.avatar === '') delete sanitized.avatar;

        if (sanitized.agentId) {
          const updated = await agentService.updateAgent(
            sanitized.agentId,
            undefined,
            sanitized,
            context
          );
          const data = normalizeAgentPayload(updated);
          return JSON.stringify({
            status: 'success',
            message: `Successfully updated agent: ${updated.name}`,
            agentId: data.id,
            data,
          });
        } else {
          if (!sanitized.name || !sanitized.systemPrompt) {
            return JSON.stringify({
              status: 'error',
              message: 'Name and systemPrompt are required to create a new agent.',
            });
          }

          // providerId isn't part of this tool's schema at all — every
          // Agent it creates uses this Project's default Provider. Keeps
          // the model from ever needing to reason about Providers (a
          // control-plane concept the Architect's caller shouldn't have to
          // know exists) and saves the tokens an extra param/tool call
          // would cost for a value that's the same 99% of the time anyway.
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
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: `Error managing agent: ${err.message}`,
        });
      }
    },
  });

/**
 * Lists/deletes/toggles visibility for this Project's own Skills. `list`
 * reuses the Discovery Contract (`discoverSkills`) rather than a "mine"
 * filter — consistent with how the read-only Studio Skills tab already
 * shows every Skill in this Project's own Domain, any owner type.
 */
export const manageSkillTool = (context) =>
  new DynamicStructuredTool({
    name: 'manage_skill',
    description:
      "Lifecycle operations for this Project's skills: list them (with IDs for attaching to agents), delete one, or toggle marketplace visibility. To CREATE or EDIT skill content, write files under /skill-library/<skill-name>/ instead (SKILL.md with YAML frontmatter + optional references/ files).",
    schema: z.object({
      action: z.enum(['list', 'delete', 'set_visibility']),
      skillId: z
        .string()
        .optional()
        .describe('ID of the skill (required for delete/set_visibility)'),
      isPublic: z
        .boolean()
        .optional()
        .describe('Marketplace visibility (required for set_visibility)'),
    }),
    func: async (input) => {
      try {
        switch (input.action) {
          case 'list': {
            const skills = await skillService.discoverSkills(context, {}, { page: 1, limit: 100 });
            return JSON.stringify({
              status: 'success',
              data: skills.map((s) => ({
                id: s._id,
                name: s.name,
                description: s.description,
                isPublic: s.isPublic,
              })),
            });
          }
          case 'delete': {
            if (!input.skillId) {
              return JSON.stringify({
                status: 'error',
                message: 'skillId is required for delete.',
              });
            }
            await skillService.deleteSkill(input.skillId, undefined, context);
            return JSON.stringify({
              status: 'success',
              message: 'Skill deleted permanently.',
            });
          }
          case 'set_visibility': {
            if (!input.skillId || typeof input.isPublic !== 'boolean') {
              return JSON.stringify({
                status: 'error',
                message: 'skillId and isPublic are required for set_visibility.',
              });
            }
            const updatedSkill = await skillService.updateSkill(
              input.skillId,
              undefined,
              { isPublic: input.isPublic },
              context
            );
            return JSON.stringify({
              status: 'success',
              message: `Skill is now ${updatedSkill.isPublic ? 'public' : 'private'}.`,
              data: {
                id: updatedSkill._id,
                name: updatedSkill.name,
                isPublic: updatedSkill.isPublic,
              },
            });
          }
          default:
            return JSON.stringify({ status: 'error', message: 'Invalid action.' });
        }
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: `Error managing skill: ${err.message}`,
        });
      }
    },
  });

export const getAgentTool = (context) =>
  new DynamicStructuredTool({
    name: 'get_agent',
    description: "Retrieves the full configuration of one of this Project's agents by its ID.",
    schema: z.object({
      agentId: z.string().describe('The ID of the agent to fetch'),
    }),
    func: async ({ agentId }) => {
      try {
        const agent = await agentService.getDeveloperAgentById(agentId, context);
        return JSON.stringify({
          status: 'success',
          data: agent,
        });
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: err.message,
        });
      }
    },
  });

export const listMyAgentsTool = (context) =>
  new DynamicStructuredTool({
    name: 'list_my_agents',
    description: 'Lists all agents owned by this Project.',
    schema: z.object({}),
    func: async () => {
      try {
        const agents = await agentService.discoverAgents(context, {}, { page: 1, limit: 100 });
        return JSON.stringify({
          status: 'success',
          data: agents.map((a) => ({
            id: a._id,
            name: a.name,
            description: a.description,
            visibility: a.visibility,
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

export const deleteAgentTool = (context) =>
  new DynamicStructuredTool({
    name: 'delete_agent',
    description: 'Permanently deletes an agent owned by this Project.',
    schema: z.object({
      agentId: z.string().describe('The ID of the agent to delete'),
    }),
    func: async ({ agentId }) => {
      try {
        await agentService.deleteAgent(agentId, undefined, context);
        return JSON.stringify({
          status: 'success',
          message: 'Agent deleted successfully.',
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
 * Factory for all Project Agent Architect tools, injected with a
 * `ProjectAdminContext` instead of a bare Persona `userId`.
 */
export const getProjectBuilderToolbox = (context) => [
  upsertAgentTool(context),
  manageSkillTool(context),
  getAgentTool(context),
  listMyAgentsTool(context),
  deleteAgentTool(context),
];
