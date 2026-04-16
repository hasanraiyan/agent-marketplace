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
      const providers = await providerRepository.findByUser(userId);
      return JSON.stringify(
        providers.map((p) => ({
          id: p._id,
          label: p.label,
          baseURL: p.baseURL,
          defaultModel: p.defaultModel,
        }))
      );
    },
  });

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
      category: z
        .enum(['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'])
        .optional(),
      visibility: z.enum(['private', 'unlisted', 'public']).optional(),
      skills: z.array(z.string()).optional().describe('Array of Skill IDs to link to this agent'),
    }),
    func: async (input) => {
      try {
        if (input.agentId) {
          const updated = await agentService.updateAgent(input.agentId, userId, { ...input });
          return `Successfully updated agent: ${updated.name} (${updated._id})`;
        } else {
          if (!input.name || !input.systemPrompt || !input.providerId) {
            return 'Error: Name, systemPrompt, and providerId are required to create a new agent.';
          }
          const created = await agentService.createAgent(userId, { ...input });
          return `Successfully created new agent: ${created.name} (${created._id})`;
        }
      } catch (err) {
        return `Error managing agent: ${err.message}`;
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
            return JSON.stringify(
              skills.map((s) => ({ id: s._id, name: s.name, description: s.description }))
            );
          case 'create':
            const newSkill = await skillService.createSkill(userId, { ...input });
            return `Skill created: ${newSkill.name} (${newSkill._id})`;
          case 'update':
            if (!input.skillId) return 'Error: skillId is required for update.';
            await skillService.updateSkill(input.skillId, userId, { ...input });
            return 'Skill updated successfully.';
          case 'delete':
            if (!input.skillId) return 'Error: skillId is required for delete.';
            await skillService.deleteSkill(input.skillId, userId);
            return 'Skill deleted permanently.';
          default:
            return 'Invalid action.';
        }
      } catch (err) {
        return `Error managing skill: ${err.message}`;
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
];
