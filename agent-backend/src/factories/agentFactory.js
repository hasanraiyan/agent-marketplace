import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent, StateBackend } from 'deepagents';
import { InMemoryStore } from '@langchain/langgraph';
import { LRUCache } from 'lru-cache';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';

import { resolveAgentTools, ARCHITECT_AGENT_ID } from '../tools/index.js';
import { loggerService } from '../utils/index.js';
import { ARCHITECT_SKILL } from '../skills/architectSkill.js';

const logger = loggerService.getLogger();

// Shared long-term memory store for all agents. Singleton ensures cross-thread
// memories persist for the lifetime of the process.
const globalStore = new InMemoryStore();

// LRU Cache for compiled Agent instances to avoid expensive graph compilation on every message.
// Small cap since each instance holds an LLM client and internal graph state.
const agentCache = new LRUCache({ max: 50 });

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
    let apiKey;
    try {
      apiKey = encryption.decrypt(provider.apiKeyEncrypted);
    } catch (err) {
      if (err.code === 'DECRYPTION_FAILED') {
        throw new Error(
          `Stored API key for provider "${provider.label}" cannot be decrypted (encryption key mismatch). ` +
            'Please re-enter the API key in Settings.'
        );
      }
      throw err;
    }

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

    // Cache key: For standard agents it is the agentId. For Architect, it is namespaced by userId
    // because the Architect's toolbox and provider are user-specific.
    const cacheKey =
      agentIdStr === ARCHITECT_AGENT_ID ? `${ARCHITECT_AGENT_ID}:${userId}` : agentIdStr;

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

    // 2. Cache Validation
    const cached = agentCache.get(cacheKey);
    if (cached && cached.updatedAt?.getTime() === agent.updatedAt?.getTime()) {
      logger.debug('[AgentFactory] cache hit', { agentId: agentIdStr });
      return {
        ...cached,
        cacheHit: true,
      };
    }

    logger.info('[AgentFactory] building agent', {
      agentId: agentIdStr,
      model: agent.modelName,
      provider: provider.label,
      skillCount: agent.skills?.length || 0,
    });

    // 3. Build Base Model
    const llm = await this._buildLLM(agent, provider);

    // Completely abstracted Tool Registry injection
    const dynamicTools = resolveAgentTools(agent, userId);

    //
    // deepagents discovers skills via the `skills: ["/skills/"]` param + the agent's
    // backend (StateBackend below). With StateBackend the skill files live in graph
    // state, so we build each DB skill as `/skills/<dir>/SKILL.md` (SKILL.md is the
    // filename the skills middleware scans for) and seed them into the run input
    // `files` map at invoke time (see agui.routes.js). They then persist for
    // the rest of the thread via the checkpointer. `skillFiles` is returned to the
    // caller so it can do that seeding.
    const skillFiles = {};
    const now = new Date().toISOString();

    // 3.5 Inject Hardcoded Architect Skill
    if (agentIdStr === ARCHITECT_AGENT_ID) {
      skillFiles['/skills/agent-architecture/SKILL.md'] = {
        content: ARCHITECT_SKILL.split('\n'),
        created_at: now,
        modified_at: now,
      };
    }

    if (agent.skills && agent.skills.length > 0) {
      for (const skill of agent.skills) {
        // Slugify the directory segment so odd skill names can't break the path.
        const dir =
          String(skill.name)
            .trim()
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase() || 'skill';
        // JSON-encode frontmatter values: colons, quotes, and newlines in
        // free-text fields are invalid as plain YAML scalars.
        const name = JSON.stringify(String(skill.name ?? dir));
        const description = JSON.stringify(String(skill.description ?? ''));
        const frontmatter = `---\nname: ${name}\ndescription: ${description}\n---\n\n${skill.instructions}`;
        skillFiles[`/skills/${dir}/SKILL.md`] = {
          content: frontmatter.split('\n'),
          created_at: now,
          modified_at: now,
        };
      }
    }
    const hasSkills = Object.keys(skillFiles).length > 0;

    // 4. Assemble Custom DeepAgent Runtime
    // Wrap checkpointer with a Proxy to preserve prototype methods (e.g. getTuple)
    // while guarding against empty bulk write batches that crash MongoDB driver.
    const safeCheckpointer = checkpointer
      ? new Proxy(checkpointer, {
          get(target, prop, receiver) {
            if (prop === 'putWrites') {
              return async (...args) => {
                // Robust empty-batch detection: scan args for any array-like candidate
                const foundArray = args.find(
                  (a) => Array.isArray(a) || (a && typeof a.length === 'number')
                );
                if (foundArray && foundArray.length === 0) return;

                // If first arg is falsy or no args, treat as no-op
                if (args.length === 0 || !args[0]) return;

                if (typeof target.putWrites === 'function') {
                  try {
                    return await target.putWrites.apply(target, args);
                  } catch (err) {
                    logger.error('[AgentFactory] checkpointer.putWrites error:', {
                      error: err?.message || err,
                    });
                    throw err; // Rethrow so failures aren't silent
                  }
                }
              };
            }

            const value = Reflect.get(target, prop, receiver);
            if (typeof value === 'function') return value.bind(target);
            return value;
          },
        })
      : checkpointer;

    // Build interruptOn from the agent's stored config. These are the built-in
    // human-in-the-loop pauses used for guarded tool execution.
    const interruptOnConfig =
      agent.interruptOn instanceof Map
        ? Object.fromEntries(agent.interruptOn)
        : agent.interruptOn || {};

    const agentInstance = await createDeepAgent({
      model: llm,
      systemPrompt: agent.systemPrompt,
      checkpointer: safeCheckpointer,
      store: globalStore,
      tools: dynamicTools,
      interruptOn: interruptOnConfig,
      // sandbox backend if real code execution is ever required.
      backend: new StateBackend(),
      // point it at the virtual /skills/ tree we seed at invoke time.
      ...(hasSkills ? { skills: ['/skills/'] } : {}),
    });

    logger.info('[AgentFactory] agent built', {
      agentId: agentIdStr,
      toolCount: dynamicTools.length,
      skillCount: Object.keys(skillFiles).length,
      hasSkills,
    });

    const result = {
      agentInstance,
      agentConfig: agent,
      updatedAt: agent.updatedAt,
      llm,
      providerConfig: {
        id: provider._id?.toString?.() || provider._id,
        label: provider.label,
        baseURL: provider.baseURL,
        modelName: agent.modelName || provider.defaultModel || 'gpt-3.5-turbo',
      },
      skillFiles,
    };

    // Cache the compiled result
    agentCache.set(cacheKey, result);

    return {
      ...result,
      cacheHit: false,
    };
  }

  /**
   * Explicitly evicts an agent from the factory cache.
   * Call this when agent configuration or skills are modified.
   */
  invalidate(agentId) {
    const idStr = agentId?.toString() || agentId;
    if (!idStr) return;

    // If it's the Architect, we'd need the userId to invalidate the specific cache entry.
    // However, most callers (controllers) only pass agentId. For now, we'll
    // iterate and clear any key starting with the ID.
    if (idStr === ARCHITECT_AGENT_ID) {
      for (const key of agentCache.keys()) {
        if (key.startsWith(ARCHITECT_AGENT_ID)) {
          agentCache.delete(key);
        }
      }
    } else {
      agentCache.delete(idStr);
    }

    logger.debug('[AgentFactory] cache invalidated', { agentId: idStr });
  }
}

export default new AgentFactory();
