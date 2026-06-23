import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import userRepository from '../repositories/userRepository.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Creates user-level memory tools:
 * 1. save_user_preference - Explicitly saves a rule/preference to the user profile
 * 2. get_user_preferences - Reads the current user profile summary and preferences
 *
 * @param {string} userId - The user ID
 * @returns {Array<DynamicStructuredTool>} Array of memory tools
 */
export function getMemoryTools(userId) {
  const savePreferenceTool = new DynamicStructuredTool({
    name: 'save_user_preference',
    description: 'Use this tool to save or update a personalization rule, preference, or fact about the user (e.g., framework preference, styling tools, language). Do this when the user explicitly requests you to remember a setting or when you learn a persistent preference.',
    schema: z.object({
      key: z.string().describe('The name of the preference (e.g., preferred_framework, styling_choice, tone)'),
      value: z.string().describe('The setting detail (e.g., "Next.js", "Tailwind CSS", "concise and technical")'),
    }),
    func: async ({ key, value }) => {
      try {
        const user = await userRepository.findById(userId);
        const existingPrefs = {};
        
        if (user.profile?.preferences instanceof Map) {
          for (const [k, v] of user.profile.preferences.entries()) {
            existingPrefs[k] = v;
          }
        } else if (user.profile?.preferences) {
          Object.assign(existingPrefs, user.profile.preferences);
        }

        existingPrefs[key] = value;
        const summary = user.profile?.summary || '';

        await userRepository.update(userId, {
          profile: {
            summary,
            preferences: existingPrefs,
            lastUpdated: new Date()
          }
        });

        logger.info(`[MemoryTool] Saved preference for user ${userId}: ${key} = ${value}`);
        return `Successfully saved preference: "${key}" is set to "${value}".`;
      } catch (err) {
        logger.error('[MemoryTool] Failed to save user preference:', err.message);
        return `Failed to save preference: ${err.message}`;
      }
    }
  });

  const getPreferencesTool = new DynamicStructuredTool({
    name: 'get_user_preferences',
    description: 'Use this tool to retrieve the user\'s currently saved profile summary and preferences.',
    schema: z.object({}),
    func: async () => {
      try {
        const user = await userRepository.findById(userId);
        if (!user || !user.profile) {
          return 'No profile or preferences found.';
        }
        
        const prefs = {};
        if (user.profile.preferences instanceof Map) {
          for (const [k, v] of user.profile.preferences.entries()) {
            prefs[k] = v;
          }
        } else if (user.profile.preferences) {
          Object.assign(prefs, user.profile.preferences);
        }

        return JSON.stringify({
          summary: user.profile.summary || 'None',
          preferences: prefs
        }, null, 2);
      } catch (err) {
        logger.error('[MemoryTool] Failed to retrieve preferences:', err.message);
        return `Failed to load preferences: ${err.message}`;
      }
    }
  });

  return [savePreferenceTool, getPreferencesTool];
}
