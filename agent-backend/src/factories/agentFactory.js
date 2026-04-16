import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent } from 'deepagents';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';

import { resolveAgentTools } from '../tools/index.js';

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
  async buildAgent(agentId, checkpointer) {
    const agentIdStr = agentId.toString();
    const cached = this.cache.get(agentIdStr);

    // 1. Fetch Configuration with populate to get attached Skills (metadata only for validation)
    const agent = await agentRepository.findById(agentId).populate('skills');
    if (!agent) throw new Error('Agent deleted or unavailable');

    // 2. Cache Validation: If already cached and hasn't been updated since, return it!
    if (cached && cached.updatedAt.getTime() === agent.updatedAt.getTime()) {
      return { 
        agentInstance: cached.instance, 
        agentConfig: agent, 
        llm: cached.llm,
        cacheHit: true 
      };
    }

    // 3. Build Base Model
    const llm = await this._buildLLM(agent);

    // Completely abstracted Tool Registry injection
    const dynamicTools = resolveAgentTools(agent);

    const { InMemoryStore } = await import('@langchain/langgraph');
    const { SkillService } = await import('deepagents');
    
    const store = new InMemoryStore();
    const skillService = new SkillService(store);

    if (agent.skills && agent.skills.length > 0) {
      for (const skill of agent.skills) {
         const frontmatter = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.instructions}`;
         await skillService.loadSkill(skill.name, frontmatter);
      }
    }

    // 4. Assemble Custom DeepAgent Runtime
    const agentInstance = await createDeepAgent({
      model: llm,
      systemPrompt: agent.systemPrompt,
      checkpointer: checkpointer,
      store: store,
      tools: dynamicTools,
      interruptOn: {
        ...(agent.interruptOn instanceof Map ? Object.fromEntries(agent.interruptOn) : agent.interruptOn),
        'ask_clarification': true, // Always force interrupt for structured questions
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
