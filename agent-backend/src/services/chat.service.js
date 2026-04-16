import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import threadRepository from '../repositories/threadRepository.js';
import messageRepository from '../repositories/messageRepository.js';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';

class ChatService {
  /**
   * Translates our local Message model into LangChain Message objects
   */
  _mapToLangchainMessages(localMessages) {
    return localMessages.map(msg => {
      switch (msg.role) {
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant':
          return new AIMessage(msg.content);
        case 'system':
          return new SystemMessage(msg.content);
        default:
          return new HumanMessage(msg.content); 
      }
    });
  }

  /**
   * Initializes the LLM configured specifically for the agent
   */
  async _getAgentModel(agent) {
    if (!agent.providerId) {
      throw new Error('Agent has no valid provider configured.');
    }

    const provider = await providerRepository.findById(agent.providerId);
    if (!provider) {
      throw new Error('Configured Provider not found or was deleted.');
    }

    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);

    // Dynamic ChatOpenAI setup pointing to the user's Creator provider.
    // Works with OpenAI, OpenRouter, Mistral, Anyscale, etc (OpenAI compatible)
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: agent.modelName || provider.defaultModel || 'gpt-3.5-turbo', // Fallback
      temperature: 0.7,
      streaming: true,
      configuration: {
        baseURL: provider.baseURL,
      },
    });
  }

  /**
   * Background task: Attempt to generate a title for a new conversation based on the first message
   */
  async _autoTitleThread(thread, firstUserMessage, llm) {
    try {
      const titlePrompt = [
        new SystemMessage('You are a helpful assistant. Provide a highly concise, 3 to 4 word summary of the user prompt. Output ONLY the summary. Example: "React Bug Fix" or "Python Setup Guide"'),
        new HumanMessage(firstUserMessage),
      ];

      const response = await llm.invoke(titlePrompt);
      const newTitle = response.content.replace(/["']/g, '').trim();

      await threadRepository.update(thread._id, { title: newTitle });
    } catch (error) {
      console.error('Failed to auto-title thread:', error.message);
      // Fail silently, auto-titling isn't critical
    }
  }

  /**
   * Resolves the thread, verifies ownership, builds context, triggers the LLM, and attaches the stream to Express Response.
   */
  async streamChat(res, threadId, userId, incomingMessage) {
    // 1. Resolve and Auth Thread
    const thread = await threadRepository.findById(threadId);
    if (!thread) {
      res.write(`data: {"error": "Thread not found"}\n\n`);
      return res.end();
    }
    if (thread.userId.toString() !== userId.toString()) {
      res.write(`data: {"error": "Unauthorized"}\n\n`);
      return res.end();
    }

    // 2. Load Agent Config
    const agent = await agentRepository.findById(thread.agentId);
    if (!agent) {
      res.write(`data: {"error": "Agent deleted or unavailable"}\n\n`);
      return res.end();
    }

    // 3. Setup SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Flush headers to establish connection immediately
    if (res.flushHeaders) res.flushHeaders(); 

    try {
      // 4. Record User Message
      await messageRepository.addMessage(thread._id, 'user', incomingMessage);
      
      // Update thread lastMessageAt
      await threadRepository.touchLastMessageAt(thread._id);

      // 5. Build Memory Context
      const pastMessages = await messageRepository.findByConversation(thread._id, { limit: 20 }); // Limit context window
      
      const langchainMessages = [
        new SystemMessage(agent.systemPrompt),
        ...this._mapToLangchainMessages(pastMessages) // includes the message we just saved
      ];

      // 6. Initialize LLM Model dynamically
      const llm = await this._getAgentModel(agent);

      // Trigger auto-titling in background if this is the very first message
      if (pastMessages.length <= 1) { // 1 = just the one we saved right now
        this._autoTitleThread(thread, incomingMessage, llm).catch(() => {});
      }

      // 7. Stream execution
      const stream = await llm.stream(langchainMessages);

      let fullResponse = '';

      for await (const chunk of stream) {
        if (chunk.content) {
          fullResponse += chunk.content;
          
          // Format specific to standard SSE
          res.write(`data: ${JSON.stringify({ chunk: chunk.content })}\n\n`);
        }
      }

      // 8. Finalize - Save Assistant Response Memory
      await messageRepository.addMessage(thread._id, 'assistant', fullResponse);

      // End connection gracefully
      res.write(`data: [DONE]\n\n`);
      res.end();

    } catch (error) {
      console.error('Chat Streaming Error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
  }

  /**
   * Simplified helper for non-streaming environments (e.g. CLI testing / webhooks)
   */
  async getChatResponse(threadId, userId, incomingMessage) {
    const thread = await threadRepository.findById(threadId);
    if (!thread || thread.userId.toString() !== userId.toString()) throw new Error('Unauthorized or not found');

    const agent = await agentRepository.findById(thread.agentId);
    if (!agent) throw new Error('Agent unavailable');

    await messageRepository.addMessage(thread._id, 'user', incomingMessage);
    await threadRepository.touchLastMessageAt(thread._id);

    const pastMessages = await messageRepository.findByConversation(thread._id, { limit: 20 });
    const langchainMessages = [
        new SystemMessage(agent.systemPrompt),
        ...this._mapToLangchainMessages(pastMessages)
    ];

    const llm = await this._getAgentModel(agent);
    
    if (pastMessages.length <= 1) {
      this._autoTitleThread(thread, incomingMessage, llm).catch(() => {});
    }

    const response = await llm.invoke(langchainMessages);
    
    await messageRepository.addMessage(thread._id, 'assistant', response.content);

    return { content: response.content };
  }
}

export default new ChatService();
