import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent } from 'deepagents';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';

import { resolveAgentTools, ARCHITECT_AGENT_ID } from '../tools/index.js';

const ARCHITECT_SYSTEM_PROMPT = `
You are the **Agent Architect**, a senior software engineer and AI specialized in building highly effective agents.
Your goal is to help the user design, build, and optimize their own custom AI agents.
- **Discovery**: List and analyze the user's existing agents and providers.
- **Architecting**: Draft and update agent system instructions (brain).
- **Engineering**: Create and manage specialized Skills (tools) and link them to agents.
- **Security**: You CANNOT view or manage API keys.
`;

import { LRUCache } from 'lru-cache';

class AgentFactory {
  constructor() {
    this.cache = new LRUCache({
      max: 100, // Cache up to 100 compiled agents
      ttl: 1000 * 60 * 10, // 10 minute default TTL
    });
  }

  /**
   * Constructs the base LLM dynamically based on the Agent's Provider Config
   */
  async _buildLLM(agent) {
    if (!agent.providerId) throw new Error('Agent has no valid provider configured.');

    const provider = await providerRepository.findById(agent.providerId);
    if (!provider) throw new Error('Configured Provider not found or was deleted.');

    // Securely decrypt the AES-256 API Key from DB into memory
    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);

    // Initializing dynamic ChatOpenAI class representing the base model
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: agent.modelName || provider.defaultModel || 'gpt-3.5-turbo',
      temperature: 0.7,
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
    const cached = this.cache.get(agentIdStr);

    let agent;

    // 1. Detect if this is the Specialized Architect (Meta-Agent)
    if (agentIdStr === ARCHITECT_AGENT_ID) {
      // Find user's default provider for the architect to use
      const userProviders = await providerRepository.findByUser(userId);
      const defaultProvider = userProviders.find((p) => p.isDefault) || userProviders[0];

      if (!defaultProvider)
        throw new Error(
          'No provider configured. Please add a provider (API Key) in settings first.'
        );

      agent = {
        _id: ARCHITECT_AGENT_ID,
        name: 'Agent Architect',
        systemPrompt: ARCHITECT_SYSTEM_PROMPT,
        providerId: defaultProvider._id,
        modelName: 'gpt-4o', // The architect should be high-intelligence
        updatedAt: new Date(0), // Version 0 (static)
        skills: [],
      };
    } else {
      // 1.5 Fetch Standard Configuration from DB
      agent = await agentRepository.findById(agentId);
      if (agent && typeof agent.populate === 'function') {
        await agent.populate('skills');
      }
      if (!agent) throw new Error('Agent deleted or unavailable');
    }

    // 2. Cache Validation: If already cached and hasn't been updated since, return it!
    if (cached && cached.updatedAt.getTime() === agent.updatedAt.getTime()) {
      return {
        agentInstance: cached.instance,
        agentConfig: agent,
        llm: cached.llm,
        cacheHit: true,
      };
    }

    // 3. Build Base Model
    const llm = await this._buildLLM(agent);

    // Completely abstracted Tool Registry injection
    const dynamicTools = resolveAgentTools(agent, userId);

    const { InMemoryStore } = await import('@langchain/langgraph');
    const deepagentsMod = await import('deepagents');

    const store = new InMemoryStore();

    // Support multiple possible export shapes from the `deepagents` package
    const PossibleSkillService =
      deepagentsMod.SkillService || deepagentsMod.default?.SkillService || deepagentsMod.default || null;

    let skillService;
    if (typeof PossibleSkillService === 'function') {
      try {
        skillService = new PossibleSkillService(store);
      } catch (err) {
        // Some packages expose a factory instead of a constructor
        if (typeof PossibleSkillService.create === 'function') {
          skillService = await PossibleSkillService.create(store);
        } else {
          throw err;
        }
      }
    } else if (PossibleSkillService && typeof PossibleSkillService.create === 'function') {
      skillService = await PossibleSkillService.create(store);
    } else {
      // Fallback shim: provide a no-op skillService so agent creation can continue
      skillService = {
        loadSkill: async () => {
          console.warn('[AgentFactory] SkillService not available — skipping skill load');
        },
      };
    }

    if (agent.skills && agent.skills.length > 0) {
      for (const skill of agent.skills) {
        const frontmatter = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.instructions}`;
        await skillService.loadSkill(skill.name, frontmatter);
      }
    }

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
                  const foundArray = args.find((a) => Array.isArray(a) || (a && typeof a.length === 'number'));
                  if (foundArray && foundArray.length === 0) return;

                  // If first arg is falsy or no args, treat as no-op
                  if (args.length === 0 || !args[0]) return;

                  if (typeof target.putWrites === 'function') {
                    return await target.putWrites.apply(target, args);
                  }
                } catch (err) {
                  // Only warn once to reduce log noise
                  if (!checkpointerWarned) {
                    console.warn('[AgentFactory] checkpointer.putWrites error:', err?.message || err);
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

    const agentInstance = await createDeepAgent({
      model: llm,
      systemPrompt: agent.systemPrompt,
      checkpointer: safeCheckpointer,
      store: store,
      tools: dynamicTools,
      interruptOn: {
        ...(agent.interruptOn instanceof Map
          ? Object.fromEntries(agent.interruptOn)
          : agent.interruptOn),
        ask_clarification: true, // Always force interrupt for structured questions
      },
    });

    // 5. Update Cache
    this.cache.set(agentIdStr, {
      instance: agentInstance,
      llm: llm,
      updatedAt: agent.updatedAt,
    });

    return { agentInstance, agentConfig: agent, llm, cacheHit: false };
  }

  /**
   * Explicitly evicts an agent from the factory cache.
   * Call this when agent configuration or skills are modified.
   */
  invalidate(agentId) {
    this.cache.delete(agentId.toString());
  }
}

export default new AgentFactory();
