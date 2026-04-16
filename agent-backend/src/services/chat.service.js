import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import threadRepository from '../repositories/threadRepository.js';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';
import { createDeepAgent } from 'deepagents';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { MongoClient } from 'mongodb';

class ChatService {
  constructor() {
    this.mongoClient = new MongoClient(process.env.MONGODB_URI);
    // Connect explicitly for safety (though driver often handles lazy connections)
    this.mongoClient.connect().catch(console.error);
    this.checkpointer = new MongoDBSaver({ client: this.mongoClient });
  }

  async _getAgentModel(agent) {
    if (!agent.providerId) {
      throw new Error('Agent has no valid provider configured.');
    }

    const provider = await providerRepository.findById(agent.providerId);
    if (!provider) {
      throw new Error('Configured Provider not found or was deleted.');
    }

    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);

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
    }
  }

  /**
   * Retrieves messages directly out of the LangGraph MongoDB Checkpointer
   */
  async getMessages(threadId, userId) {
    const thread = await threadRepository.findById(threadId);
    if (!thread) throw new Error('Thread not found');
    if (thread.userId.toString() !== userId.toString()) throw new Error('Unauthorized');
    
    // Grab the graph snapshot from the LangGraph checkpointer natively
    const snapshot = await this.checkpointer.getTuple({ configurable: { thread_id: thread.threadId } });
    
    if (!snapshot || !snapshot.checkpoint || !snapshot.checkpoint.channel_values) {
      return [];
    }
    
    // In basic graph setups, messages channel contains the history array
    return snapshot.checkpoint.channel_values.messages || [];
  }

  async streamChat(res, threadId, userId, incomingMessage) {
    const thread = await threadRepository.findById(threadId);
    
    if (!thread) {
      res.write(`data: {"error": "Thread not found"}\n\n`);
      return res.end();
    }
    if (thread.userId.toString() !== userId.toString()) {
      res.write(`data: {"error": "Unauthorized"}\n\n`);
      return res.end();
    }

    const agent = await agentRepository.findById(thread.agentId);
    if (!agent) {
      res.write(`data: {"error": "Agent deleted or unavailable"}\n\n`);
      return res.end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    try {
      await threadRepository.touchLastMessageAt(thread._id);

      const llm = await this._getAgentModel(agent);

      // Build DeepAgent wrapper and attach the native checkpoint memory module
      const agentInstance = await createDeepAgent({
        model: llm,
        systemPrompt: agent.systemPrompt,
        checkpointer: this.checkpointer,
        // TBD: Inject custom dynamic tools assigned to this agent in MVP iterations
      });

      // Execute V2 stream! Only sending in the new HumanMessage.
      // LangGraph dynamically fetches the previous thread context natively.
      const stream = agentInstance.streamEvents(
        { messages: [new HumanMessage(incomingMessage)] },
        { configurable: { thread_id: thread.threadId }, version: "v2" }
      );

      for await (const event of stream) {
        const { event: evtName, data, name } = event;

        if (evtName === 'on_chat_model_stream') {
          const chunk = data?.chunk?.content;
          if (typeof chunk === 'string' && chunk) {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          }
        } 
        else if (evtName === 'on_tool_start') {
          // Native integration with future deepagents tools
          const toolName = name || data?.name || "tool";
          res.write(`data: ${JSON.stringify({ tool: `Executing ${toolName}...` })}\n\n`);
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();

      // Trigger automatic background title update if thread is completely fresh
      if (thread.title === 'New Conversation') {
        this._autoTitleThread(thread, incomingMessage, llm).catch(() => {});
      }

    } catch (error) {
      console.error('Chat Streaming Error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
  }
}

export default new ChatService();
