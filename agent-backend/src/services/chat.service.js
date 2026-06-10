import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import threadRepository from '../repositories/threadRepository.js';
import agentFactory from '../factories/agentFactory.js';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { Command } from '@langchain/langgraph';
import { MongoClient } from 'mongodb';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

class ChatService {
  constructor() {
    if (process.env.MONGODB_URI) {
      this.mongoClient = new MongoClient(process.env.MONGODB_URI);
      this.mongoClient.connect().catch(console.error);
      this.checkpointer = new MongoDBSaver({ client: this.mongoClient });
    }
  }

  async _autoTitleThread(thread, firstUserMessage, llm) {
    try {
      const titlePrompt = [
        new SystemMessage(
          'You are a helpful assistant. Provide a highly concise, 3 to 4 word summary of the user prompt. Output ONLY the summary. Example: "React Bug Fix" or "Python Setup Guide"'
        ),
        new HumanMessage(firstUserMessage),
      ];

      const response = await llm.invoke(titlePrompt);
      const newTitle = response.content.replace(/["']/g, '').trim();

      await threadRepository.update(thread._id, { title: newTitle });
      return newTitle;
    } catch (error) {
      console.error('Failed to auto-title thread:', error.message);
    }
  }

  async getMessages(threadId, userId) {
    const thread = await threadRepository.findById(threadId);
    if (!thread) throw new Error('Thread not found');
    if (thread.userId.toString() !== userId.toString()) throw new Error('Unauthorized');

    const snapshot = await this.checkpointer.getTuple({
      configurable: { thread_id: thread.threadId },
    });

    if (!snapshot || !snapshot.checkpoint || !snapshot.checkpoint.channel_values) {
      return [];
    }

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

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    try {
      await threadRepository.touchLastMessageAt(thread._id);

      // Ensure we have a valid agentId even if populate failed (common for virtual agents)
      let agentId = thread.agentId?._id || thread.agentId;

      // If agentId is still null (but was supposed to be populated), try to get the raw ID
      if (!agentId && typeof thread.populated === 'function') {
        const rawId = thread.populated('agentId');
        if (rawId) agentId = rawId;
      }

      // Last resort fallback to the field itself if not populated
      if (!agentId) agentId = thread.agentId;

      // DELAGATE ENTIRE GRAPH COMPILATION TO FACTORY DESIGN PATTERN
      const { agentInstance, agentConfig, llm } = await agentFactory.buildAgent(
        agentId,
        userId,
        this.checkpointer
      );

      const stream = agentInstance.streamEvents(
        { messages: [new HumanMessage(incomingMessage)] },
        { configurable: { thread_id: thread.threadId }, version: 'v2' }
      );

      // Keep-alive timer to prevent connection timeouts during long tool runs
      const keepAlive = setInterval(() => {
        res.write(': keep-alive\n\n');
      }, 15000);

      try {
        for await (const event of stream) {
          const { event: evtName, data, name } = event;
          logger.debug(`[ChatService] Received event: ${evtName}`, { name: name || data?.name });

          if (evtName === 'on_chat_model_stream') {
            const chunk = data?.chunk?.content;
            if (typeof chunk === 'string' && chunk) {
              res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            }
          } else if (evtName === 'on_tool_start') {
            const toolName = name || data?.name || 'tool';
            res.write(`data: ${JSON.stringify({ tool: `Executing ${toolName}...` })}\n\n`);
          } else if (evtName === 'on_tool_end') {
            const toolName = name || data?.name || 'tool';
            res.write(`data: ${JSON.stringify({ tool_output: data.output, tool: toolName })}\n\n`);
          } else if (evtName === 'on_custom_event' && data?.type === 'interrupt') {
            res.write(
              `data: ${JSON.stringify({ interrupt: true, tool: data.tool, args: data.args })}\n\n`
            );
          }
        }
      } finally {
        clearInterval(keepAlive);
      }

      res.write(`data: [DONE]\n\n`);
      res.end();

      if (thread.title === 'New Conversation') {
        this._autoTitleThread(thread, incomingMessage, llm).catch(() => {});
      }
    } catch (error) {
      if (error?.name === 'GraphInterrupt' || error?.message?.includes('interrupt')) {
        res.write(`data: ${JSON.stringify({ interrupt: true })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }
      console.error('Chat Streaming Error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
  }

  async handleAction(res, threadId, userId, action, feedback, answers) {
    const thread = await threadRepository.findById(threadId);

    if (!thread || thread.userId.toString() !== userId.toString()) {
      res.write(`data: {"error": "Thread not found or unauthorized"}\n\n`);
      return res.end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    try {
      const { agentInstance } = await agentFactory.buildAgent(
        thread.agentId,
        userId,
        this.checkpointer
      );

      let resumePayload;
      if (answers) {
        // Special case: Returning structured clarification answers
        resumePayload = {
          decisions: [{ type: 'approve', answers }],
        };
      } else {
        resumePayload =
          action === 'approve'
            ? { decisions: [{ type: 'approve' }] }
            : { decisions: [{ type: 'reject', message: feedback || 'Rejected by user' }] };
      }

      const stream = agentInstance.streamEvents(new Command({ resume: resumePayload }), {
        configurable: { thread_id: thread.threadId },
        version: 'v2',
      });

      for await (const event of stream) {
        const { event: evtName, data, name } = event;

        if (evtName === 'on_chat_model_stream') {
          const chunk = data?.chunk?.content;
          if (typeof chunk === 'string' && chunk) {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          }
        } else if (evtName === 'on_tool_start') {
          const toolName = name || data?.name || 'tool';
          res.write(`data: ${JSON.stringify({ tool: `Executing ${toolName}...` })}\n\n`);
        } else if (evtName === 'on_tool_end') {
          const toolName = name || data?.name || 'tool';
          res.write(`data: ${JSON.stringify({ tool_output: data.output, tool: toolName })}\n\n`);
        } else if (evtName === 'on_custom_event' && data?.type === 'interrupt') {
          res.write(
            `data: ${JSON.stringify({ interrupt: true, tool: data.tool, args: data.args })}\n\n`
          );
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error) {
      if (error?.name === 'GraphInterrupt' || error?.message?.includes('interrupt')) {
        res.write(`data: ${JSON.stringify({ interrupt: true })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }
      console.error('Action Resumption Error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message || 'Action failed' })}\n\n`);
      res.end();
    }
  }
}

export default new ChatService();
