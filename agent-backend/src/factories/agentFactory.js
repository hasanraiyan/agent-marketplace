import { ChatOpenAI } from '@langchain/openai';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';

import { ARCHITECT_AGENT_ID } from '../tools/index.js';
import { loggerService } from '../utils/index.js';

import { bindTools } from './toolBinder.js';
import { compileGraph } from './graphCompiler.js';

const logger = loggerService.getLogger();

const ARCHITECT_SYSTEM_PROMPT = `
You are the **Agent Architect**, a senior software engineer and AI specialized in building highly effective agents.
Your goal is to help the user design, build, and optimize their own custom AI agents.

### YOUR WORKFLOW
1.  **Understand**: Ask questions to understand the purpose, personality, and capabilities of the agent the user wants to build.
    *   Use the \`ask_clarification\` tool when a small set of choices would help the user answer faster, especially for agent purpose, tone/personality, capabilities, category, or output format. Prefer 2-4 questions; never ask more than 12.
    *   Prefer 2-4 clear options and avoid asking trivial questions you can safely infer.
2.  **Propose & Execute**: Once you have enough info (Name, Goal), use the \`upsert_agent\` tool to create or update the agent. 
    *   **NEVER** just say you will do it. **ALWAYS** call the tool immediately.
    *   If creating a new agent, ensure you've called \`list_my_providers\` first to pick a valid providerId.
3.  **Refine**: After updating the agent configuration, tell the user what you changed and ask if they'd like to adjust anything (e.g., system prompt, model, visibility).

### GUIDELINES
-   **System Prompts**: Draft high-quality, professional system prompts that use expert-level instructions.
-   **Descriptions**: Keep descriptions punchy and informative (1-2 sentences).
-   **Transparency**: When you call a tool, briefly explain what you are setting (e.g., "I'm setting up your coding assistant with the GPT-4o model and web search enabled.").
-   **No Keys**: You CANNOT view or manage API keys.
`;

class AgentFactory {
  _assertProviderCredentials(provider, apiKey) {
    const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : '';

    if (!trimmedKey) {
      throw new Error(
        `Provider "${provider.label}" is missing an API key. Update it in Settings before running this agent.`
      );
    }

    const looksLikePlaceholder =
      /^sk-your-/i.test(trimmedKey) ||
      /your-api-key/i.test(trimmedKey) ||
      /placeholder/i.test(trimmedKey);

    if (looksLikePlaceholder) {
      throw new Error(
        `Provider "${provider.label}" is using a placeholder API key. Update it in Settings before running this agent.`
      );
    }
  }

  /**
   * Constructs the base LLM dynamically based on the Agent's Provider Config
   */
  async _buildLLM(agent, provider) {
    if (!agent.providerId) throw new Error('Agent has no valid provider configured.');
    if (!provider) throw new Error('Configured Provider not found or was deleted.');

    // Securely decrypt the AES-256 API Key from DB into memory
    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
    this._assertProviderCredentials(provider, apiKey);

    // Initializing dynamic ChatOpenAI class representing the base model
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: agent.modelName || provider.defaultModel || 'gpt-3.5-turbo',
      streaming: true,
      configuration: {
        baseURL: provider.baseURL,
      },
    });
  }

  /**
   * Factory Method: Builds and returns the compiled DeepAgent graph instance.
   * Leverages LRU caching to avoid expensive recompilation for the same agent.
   */
  async buildAgent(agentId, userId, checkpointer) {
    if (!agentId) throw new Error('Agent ID is required to build an agent');

    const agentIdStr = agentId._id ? agentId._id.toString() : agentId.toString();

    let agent;
    let provider;

    // 1. Detect if this is the Specialized Architect (Meta-Agent)
    if (agentIdStr === ARCHITECT_AGENT_ID) {
      // Find user's default provider for the architect to use
      const userProviders = await providerRepository.findByUser(userId);
      const defaultProvider = userProviders.find((p) => p.isDefault) || userProviders[0];

      if (!defaultProvider)
        throw new Error(
          'No provider configured. Please add a provider (API Key) in settings first.'
        );

      provider = defaultProvider;
      agent = {
        _id: ARCHITECT_AGENT_ID,
        name: 'Agent Architect',
        systemPrompt: ARCHITECT_SYSTEM_PROMPT,
        providerId: provider._id,
        modelName: provider.defaultModel || 'gpt-4o', // The architect should be high-intelligence
        updatedAt: new Date(0), // Version 0 (static)
        skills: [],
        interruptOn: {
          upsert_agent: true,
          manage_skill: true,
          delete_agent: true,
        },
      };
    } else {
      // 1.5 Fetch Standard Configuration from DB
      agent = await agentRepository.findById(agentId);
      if (agent && typeof agent.populate === 'function') {
        await agent.populate('skills');
      }
      if (!agent) throw new Error('Agent deleted or unavailable');

      if (!agent.providerId) throw new Error('Agent has no valid provider configured.');
      provider = await providerRepository.findById(agent.providerId);
      if (!provider) throw new Error('Configured Provider not found or was deleted.');
    }

    logger.info('[AgentFactory] building agent', {
      agentId: agentIdStr,
      model: agent.modelName,
      provider: provider.label,
      skillCount: agent.skills?.length || 0,
    });

    // 3. Build Base Model
    const llm = await this._buildLLM(agent, provider);

    // Completely abstracted Tool Registry injection and skill materialization
    const { dynamicTools, skillFiles, hasSkills } = bindTools(agent, userId);

    // Compile the LangGraph instance
    const { agentInstance, store } = await compileGraph({
      llm,
      systemPrompt: agent.systemPrompt,
      checkpointer,
      tools: dynamicTools,
      interruptOn: agent.interruptOn,
      hasSkills,
    });

    logger.info('[AgentFactory] agent built', {
      agentId: agentIdStr,
      toolCount: dynamicTools.length,
      skillCount: Object.keys(skillFiles).length,
      hasSkills,
    });

    return {
      agentInstance,
      store,
      agentConfig: agent,
      llm,
      providerConfig: {
        id: provider._id?.toString?.() || provider._id,
        label: provider.label,
        baseURL: provider.baseURL,
        modelName: agent.modelName || provider.defaultModel || 'gpt-3.5-turbo',
      },
      skillFiles,
      cacheHit: false,
    };
  }

  /**
   * Explicitly evicts an agent from the factory cache.
   * Call this when agent configuration or skills are modified.
   */
  invalidate(agentId) {
    // Cache system is disabled/removed. No-op.
  }
}

export default new AgentFactory();
