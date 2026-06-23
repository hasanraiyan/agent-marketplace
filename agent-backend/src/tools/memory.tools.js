import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import userRepository from '../repositories/userRepository.js';
import { loggerService } from '../utils/index.js';
import checkpointService from '../services/checkpoint.service.js';
import { MongoDBStore } from '../utils/mongoStore.js';

const logger = loggerService.getLogger();

let agentStoreInstance = null;
function getAgentStore() {
  if (!agentStoreInstance && checkpointService.mongoClient) {
    agentStoreInstance = new MongoDBStore({ client: checkpointService.mongoClient });
  }
  return agentStoreInstance;
}

/**
 * Creates user-level and agent-level memory tools:
 * 1. save_user_preference - Explicitly saves a rule/preference to the user profile
 * 2. get_user_preferences - Reads the current user profile summary and preferences
 * 3. save_agent_memory - Saves key-value facts/learnings to the agent's long-term memory store
 * 4. get_agent_memories - Reads the agent's stored memory keys/values
 *
 * @param {string} userId - The user ID
 * @param {string} [agentId] - Optional agent ID
 * @returns {Array<DynamicStructuredTool>} Array of memory tools
 */
export function getMemoryTools(userId, agentId) {
  const savePreferenceTool = new DynamicStructuredTool({
    name: 'save_user_preference',
    description:
      'Use this tool to save or update a personalization rule, preference, or fact about the user (e.g., framework preference, styling tools, language). Do this when the user explicitly requests you to remember a setting or when you learn a persistent preference.',
    schema: z.object({
      key: z
        .string()
        .describe('The name of the preference (e.g., preferred_framework, styling_choice, tone)'),
      value: z
        .string()
        .describe('The setting detail (e.g., "Next.js", "Tailwind CSS", "concise and technical")'),
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
            lastUpdated: new Date(),
          },
        });

        logger.info(`[MemoryTool] Saved preference for user ${userId}: ${key} = ${value}`);
        return `Successfully saved preference: "${key}" is set to "${value}".`;
      } catch (err) {
        logger.error('[MemoryTool] Failed to save user preference:', err.message);
        return `Failed to save preference: ${err.message}`;
      }
    },
  });

  const getPreferencesTool = new DynamicStructuredTool({
    name: 'get_user_preferences',
    description:
      "Use this tool to retrieve the user's currently saved profile summary and preferences.",
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

        return JSON.stringify(
          {
            summary: user.profile.summary || 'None',
            preferences: prefs,
          },
          null,
          2
        );
      } catch (err) {
        logger.error('[MemoryTool] Failed to retrieve preferences:', err.message);
        return `Failed to load preferences: ${err.message}`;
      }
    },
  });

  const tools = [savePreferenceTool, getPreferencesTool];

  if (agentId) {
    const saveAgentMemoryTool = new DynamicStructuredTool({
      name: 'save_agent_memory',
      description:
        "Use this tool to save key-value facts, instructions, or learnings to your long-term memory so that they persist across all conversations for this specific agent. Do this when you learn something generally useful for this agent's tasks.",
      schema: z.object({
        key: z
          .string()
          .describe('The name of the memory item (e.g. custom_template, resolved_issue_pattern)'),
        value: z
          .string()
          .describe(
            'The content/value to store for this memory key (if structured, pass it as a JSON-stringified object/array)'
          ),
      }),
      func: async ({ key, value }) => {
        try {
          const store = getAgentStore();
          if (!store) {
            throw new Error('Database store not initialized');
          }

          let parsedValue = value;
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // Keep as string if not valid JSON
          }

          const namespace = [agentId];
          await store.put(namespace, key, parsedValue);

          logger.info(`[MemoryTool] Saved agent memory for agent ${agentId}: ${key}`);
          return `Successfully saved agent memory: "${key}" has been recorded.`;
        } catch (err) {
          logger.error('[MemoryTool] Failed to save agent memory:', err.message);
          return `Failed to save agent memory: ${err.message}`;
        }
      },
    });

    const getAgentMemoriesTool = new DynamicStructuredTool({
      name: 'get_agent_memories',
      description:
        'Use this tool to retrieve all key-value items saved in your long-term agent-level memory.',
      schema: z.object({}),
      func: async () => {
        try {
          const store = getAgentStore();
          if (!store) {
            throw new Error('Database store not initialized');
          }
          const namespace = [agentId];
          const results = await store.search(namespace);
          return JSON.stringify(results || [], null, 2);
        } catch (err) {
          logger.error('[MemoryTool] Failed to retrieve agent memories:', err.message);
          return `Failed to retrieve agent memories: ${err.message}`;
        }
      },
    });

    tools.push(saveAgentMemoryTool, getAgentMemoriesTool);
  }

  return tools;
}
