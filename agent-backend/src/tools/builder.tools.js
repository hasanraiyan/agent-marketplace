import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import agentService from '../services/agent.service.js';
import skillService from '../services/skill.service.js';
import providerRepository from '../repositories/providerRepository.js';

/**
 * ARCHITECT TOOLBOX:
 * A specialized set of tools that allow an LLM to build and manage agents and skills.
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

/**
 * upsert_agent - Full control over the target agent's configuration.
 */
export const upsertAgentTool = (userId) =>
  new DynamicStructuredTool({
    name: 'upsert_agent',
    description:
      'Creates or updates an agent configuration. Handles basic info, instructions, and runtime settings.',
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
      providerId: z.string().optional().describe('ID of the LLM provider to use'),
      modelName: z.string().optional().describe('Specific model (e.g., gpt-4o)'),
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
        // Clean up empty strings for optional fields
        const sanitized = { ...input };
        if (sanitized.description === '') delete sanitized.description;
        if (sanitized.avatar === '') delete sanitized.avatar;
        if (sanitized.modelName === '') delete sanitized.modelName;

        // Verify provider ownership if providerId is changed
        if (sanitized.providerId) {
          const provider = await providerRepository.findById(sanitized.providerId);
          if (!provider || provider.ownerId.toString() !== userId.toString()) {
            return JSON.stringify({
              status: 'error',
              message: 'Invalid providerId or unauthorized.',
            });
          }
        }

        if (sanitized.agentId) {
          const updated = await agentService.updateAgent(sanitized.agentId, userId, {
            ...sanitized,
          });
          const data = normalizeAgentPayload(updated);
          return JSON.stringify({
            status: 'success',
            message: `Successfully updated agent: ${updated.name}`,
            agentId: data.id,
            data,
          });
        } else {
          if (!sanitized.name || !sanitized.systemPrompt || !sanitized.providerId) {
            return JSON.stringify({
              status: 'error',
              message: 'Name, systemPrompt, and providerId are required to create a new agent.',
            });
          }
          const created = await agentService.createAgent(userId, { ...sanitized });
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
 * manage_skill - CRUD for individual skills.
 */
export const manageSkillTool = (userId) =>
  new DynamicStructuredTool({
    name: 'manage_skill',
    description:
      'Creates, updates, or lists skills owned by the user. Skills are standalone logic blocks that can be attached to agents.',
    schema: z.object({
      action: z.enum(['create', 'update', 'list', 'delete']),
      skillId: z.string().optional().describe('ID of the skill (required for update/delete)'),
      name: z.string().optional().describe('Short name (e.g., "weather-parser")'),
      description: z.string().optional(),
      instructions: z.string().optional().describe('The core logic / SKILL.md content'),
      isPublic: z.boolean().optional(),
    }),
    func: async (input) => {
      try {
        switch (input.action) {
          case 'list':
            const skills = await skillService.getMySkills(userId);
            return JSON.stringify({
              status: 'success',
              data: skills.map((s) => ({
                id: s._id,
                name: s.name,
                description: s.description,
              })),
            });
          case 'create':
            if (!input.name || !input.instructions || !input.description) {
              return JSON.stringify({
                status: 'error',
                message: 'name, description, and instructions are required for create.',
              });
            }
            // Validate name regex ^[a-z0-9-]+$
            if (!/^[a-z0-9-]+$/.test(input.name)) {
              return JSON.stringify({
                status: 'error',
                message: 'Skill name must contain only lowercase letters, numbers, and hyphens.',
              });
            }
            if (input.name.length < 2 || input.name.length > 64) {
              return JSON.stringify({
                status: 'error',
                message: 'Skill name must be between 2 and 64 characters.',
              });
            }
            if (input.description.length > 1024) {
              return JSON.stringify({
                status: 'error',
                message: 'Skill description must be 1024 characters or less.',
              });
            }
            const newSkill = await skillService.createSkill(userId, { ...input });
            return JSON.stringify({
              status: 'success',
              message: `Skill created: ${newSkill.name}`,
              data: newSkill,
            });
          case 'update':
            if (!input.skillId) {
              return JSON.stringify({
                status: 'error',
                message: 'skillId is required for update.',
              });
            }
            if (input.name && !/^[a-z0-9-]+$/.test(input.name)) {
              return JSON.stringify({
                status: 'error',
                message: 'Skill name must contain only lowercase letters, numbers, and hyphens.',
              });
            }
            const updatedSkill = await skillService.updateSkill(input.skillId, userId, {
              ...input,
            });
            return JSON.stringify({
              status: 'success',
              message: 'Skill updated successfully.',
              data: updatedSkill,
            });
          case 'delete':
            if (!input.skillId) {
              return JSON.stringify({
                status: 'error',
                message: 'skillId is required for delete.',
              });
            }
            await skillService.deleteSkill(input.skillId, userId);
            return JSON.stringify({
              status: 'success',
              message: 'Skill deleted permanently.',
            });
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

/**
 * get_agent - Fetch a single agent by ID.
 */
export const getAgentTool = (userId) =>
  new DynamicStructuredTool({
    name: 'get_agent',
    description: 'Retrieves the full configuration of a specific agent by its ID.',
    schema: z.object({
      agentId: z.string().describe('The ID of the agent to fetch'),
    }),
    func: async ({ agentId }) => {
      try {
        const agent = await agentService.getAgentById(agentId, userId);
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

/**
 * list_my_agents - List all agents owned by the user.
 */
export const listMyAgentsTool = (userId) =>
  new DynamicStructuredTool({
    name: 'list_my_agents',
    description: 'Lists all agents owned by the current user.',
    schema: z.object({}),
    func: async () => {
      try {
        const agents = await agentService.searchAgents({ ownerId: userId }, {}, userId);
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

/**
 * delete_agent - Deletes an agent.
 */
export const deleteAgentTool = (userId) =>
  new DynamicStructuredTool({
    name: 'delete_agent',
    description: 'Permanently deletes an agent owned by the user.',
    schema: z.object({
      agentId: z.string().describe('The ID of the agent to delete'),
    }),
    func: async ({ agentId }) => {
      try {
        await agentService.deleteAgent(agentId, userId);
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
 * get_builder_toolbox - Factory for all architect tools injected with contextual userId
 */
export const getBuilderToolbox = (userId) => [
  listProvidersTool(userId),
  upsertAgentTool(userId),
  manageSkillTool(userId),
  getAgentTool(userId),
  listMyAgentsTool(userId),
  deleteAgentTool(userId),
];
