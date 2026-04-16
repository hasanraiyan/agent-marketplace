import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent } from 'deepagents';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';

import { resolveAgentTools } from '../tools/index.js';

class AgentFactory {
  constructor() {
    this.cache = new Map();
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
   * Factory Method: Builds and returns the compiled DeepAgent graph instance
   */
  async buildAgent(agentId, checkpointer) {
    // 1. Fetch Configuration with populate to get attached Skills
    const agent = await agentRepository.findById(agentId).populate('skills');
    if (!agent) throw new Error('Agent deleted or unavailable');

    // 2. Build Base Model
    const llm = await this._buildLLM(agent);

    // Completely abstracted Tool Registry injection
    const dynamicTools = resolveAgentTools(agent);

    const { InMemoryStore } = await import('@langchain/langgraph');
    const { SkillService } = await import('deepagents');
    
    const store = new InMemoryStore();
    const skillService = new SkillService(store);

    if (agent.skills && agent.skills.length > 0) {
      // Loop over populated Skills and load them natively into the store!
      for (const skill of agent.skills) {
         // Create the frontmatter exactly as deepagent expects
         const frontmatter = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.instructions}`;
         await skillService.loadSkill(skill.name, frontmatter);
      }
    }

    // 5. Assemble Custom DeepAgent Runtime
    const agentInstance = await createDeepAgent({
      model: llm,
      systemPrompt: agent.systemPrompt,
      checkpointer: checkpointer,
      store: store,
      tools: dynamicTools,
    });

    return { agentInstance, agentConfig: agent, llm };
  }
}

export default new AgentFactory();
