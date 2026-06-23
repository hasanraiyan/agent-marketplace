import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import userRepository from '../repositories/userRepository.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Periodically processes recent conversation history to extract user preferences,
 * updating the user profile in MongoDB.
 */
export async function extractAndSaveMemory(userId, chatHistory, llmConfig) {
  if (!chatHistory || chatHistory.length === 0) return;

  const apiKey = llmConfig?.apiKey;
  if (!apiKey) {
    logger.warn('[MemoryCollector] No API Key provided for memory extraction.');
    return;
  }

  // Use a fast model like gpt-4o-mini, or fallback to provider settings if custom baseURL is present
  const options = {
    apiKey: apiKey,
    openAIApiKey: apiKey,
    modelName: llmConfig?.baseURL ? (llmConfig.modelName || 'gpt-4o-mini') : 'gpt-4o-mini',
    temperature: 0,
    configuration: {
      apiKey: apiKey,
    },
  };

  if (llmConfig?.baseURL) {
    options.configuration.baseURL = llmConfig.baseURL;
  }

  const llm = new ChatOpenAI(options);

  const formattedHistory = chatHistory.map(m => {
    let role = 'user';
    if (m._getType) {
      role = m._getType();
    } else if (m.type) {
      role = m.type;
    }
    return `${role.toUpperCase()}: ${m.content}`;
  }).join('\n');

  const prompt = [
    new SystemMessage(
      `You are a profile memory extractor. Analyze the recent conversation history and output key facts about the User. 
      Focus on preferences, coding languages, project goals, workflow setups, or specific requests.
      Output ONLY a JSON block containing "summary" (a 2-3 sentence overview of who they are) and "preferences" (key-value updates of specific settings).
      Example:
      {
        "summary": "Full stack engineer specializing in React and Node.js. Prefers clean, modular functions.",
        "preferences": {
          "preferred_backend": "Node.js (Express)",
          "style_preference": "Functional components, hooks"
        }
      }`
    ),
    new HumanMessage(`Analyze the following history:\n${formattedHistory}`),
  ];

  try {
    const response = await llm.invoke(prompt);
    let content = response.content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (content.startsWith('```')) {
      content = content.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const result = JSON.parse(content);
    
    // Fetch current user profile to merge preferences
    const user = await userRepository.findById(userId);
    const existingSummary = user.profile?.summary || '';
    const existingPrefs = {};

    if (user.profile?.preferences instanceof Map) {
      for (const [key, val] of user.profile.preferences.entries()) {
        existingPrefs[key] = val;
      }
    } else if (user.profile?.preferences) {
      Object.assign(existingPrefs, user.profile.preferences);
    }

    // Merge new preferences into existing preferences
    const mergedPrefs = { ...existingPrefs, ...result.preferences };
    const mergedSummary = result.summary || existingSummary;

    logger.info(`[MemoryCollector] Extracted memory for user ${userId}. Merging summary and ${Object.keys(result.preferences || {}).length} preferences.`);

    await userRepository.update(userId, {
      profile: {
        summary: mergedSummary,
        preferences: mergedPrefs,
        lastUpdated: new Date()
      }
    });
  } catch (err) {
    logger.error('[MemoryCollector] Failed to extract user memory:', err.message);
  }
}
