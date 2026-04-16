import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent } from 'deepagents';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';

class AgentFactory {
  // A simple in-memory LRU cache concept for future scaling 
  // so we don't compile LangGraph on every single ping
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
    // 1. Fetch Configuration
    const agent = await agentRepository.findById(agentId);
    if (!agent) throw new Error('Agent deleted or unavailable');

    // 2. Build Base Model
    const llm = await this._buildLLM(agent);

    // 3. Assemble Dynamic Tools Array
    const dynamicTools = [];
    if (agent.webSearchEnabled) {
      if (!process.env.TAVILY_API_KEY) {
        console.warn('Tavily Search is enabled for this agent, but TAVILY_API_KEY is missing from environment.');
      } else {
        const { TavilySearch } = await import('@langchain/tavily');
        dynamicTools.push(new TavilySearch({
          maxResults: 5,
          searchDepth: 'advanced',
          name: 'search_web',
          description: 'Search the web for up-to-date information on any topic.',
        }));
      }
    }

    // 4. Assemble Custom DeepAgent Runtime
    const agentInstance = await createDeepAgent({
      model: llm,
      systemPrompt: agent.systemPrompt,
      checkpointer: checkpointer,
      tools: dynamicTools,
    });

    return { agentInstance, agentConfig: agent, llm };
  }
}

export default new AgentFactory();
