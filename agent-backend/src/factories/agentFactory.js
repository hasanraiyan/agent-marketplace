import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent, StateBackend } from 'deepagents';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';

import { resolveAgentTools, ARCHITECT_AGENT_ID } from '../tools/index.js';
import { loggerService } from '../utils/index.js';
import { ARCHITECT_SKILL } from '../skills/architectSkill.js';

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

    // Completely abstracted Tool Registry injection
    const dynamicTools = resolveAgentTools(agent, userId);

    const { InMemoryStore } = await import('@langchain/langgraph');
    const store = new InMemoryStore();

    // Materialize the agent's configured skills into deepagents' virtual filesystem.
    //
    // deepagents discovers skills via the `skills: ["/skills/"]` param + the agent's
    // backend (StateBackend below). With StateBackend the skill files live in graph
    // state, so we build each DB skill as `/skills/<dir>/SKILL.md` (SKILL.md is the
    // filename the skills middleware scans for) and seed them into the run input
    // `files` map at invoke time (see agui.routes.js). They then persist for
    // the rest of the thread via the checkpointer. `skillFiles` is returned to the
    // caller so it can do that seeding.
    //
    // NOTE: this replaces a previous hand-rolled `SkillService` lookup that always
    // fell through to a no-op shim (deepagents exposes `createSkillsMiddleware`, not
    // a `SkillService` class), so skills were silently never loaded.
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
    // Track whether we've warned to avoid log spam
    let checkpointerWarned = false;

    const safeCheckpointer = checkpointer
      ? new Proxy(checkpointer, {
          get(target, prop, receiver) {
            if (prop === 'putWrites') {
              return async (...args) => {
                try {
                  // Robust empty-batch detection: scan args for any array-like candidate
                  const foundArray = args.find(
                    (a) => Array.isArray(a) || (a && typeof a.length === 'number')
                  );
                  if (foundArray && foundArray.length === 0) return;

                  // If first arg is falsy or no args, treat as no-op
                  if (args.length === 0 || !args[0]) return;

                  if (typeof target.putWrites === 'function') {
                    return await target.putWrites.apply(target, args);
                  }
                } catch (err) {
                  // Only warn once to reduce log noise
                  if (!checkpointerWarned) {
                    console.warn(
                      '[AgentFactory] checkpointer.putWrites error:',
                      err?.message || err
                    );
                    checkpointerWarned = true;
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
      store: store,
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

    return {
      agentInstance,
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
