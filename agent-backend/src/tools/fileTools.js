import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import skillService from '../services/skill.service.js';

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
