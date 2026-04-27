import express from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { CopilotRuntime, BuiltInAgent } from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';
import { EventType } from '@ag-ui/core';
import { HumanMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';
import authMiddleware from '../middlewares/auth.middleware.js';
import agentFactory from '../factories/agentFactory.js';
import threadRepository from '../repositories/threadRepository.js';
import chatService from '../services/chat.service.js';

// Carries per-request { userId, agentId, langGraphThreadId } through the async chain
const requestStore = new AsyncLocalStorage();

const copilotRouter = express.Router();

// Auth + context injection. Skip OPTIONS so CopilotKit's built-in CORS preflight works.
copilotRouter.use(async (req, res, next) => {
  console.log(`[CopilotKit] Incoming ${req.method} request to: ${req.url}`);
  
  if (req.method === 'OPTIONS') return next();

  try {
    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err) => (err ? reject(err) : resolve()));
    });

    const userId = req.user._id;
    console.log(`[CopilotKit] Auth successful for user: ${userId}`);
    // Custom headers carry agentId/threadId so the runtimeUrl stays query-param-free
    // (CopilotKit appends /info, /agent/:id/run, etc. to runtimeUrl at the call site).
    const agentId = req.headers['x-agent-id'] || req.query.agentId;
    const threadDbId = req.headers['x-thread-id'] || req.query.threadId;

    let langGraphThreadId = agentId ? `cpk-${agentId}-${userId}` : null;
    if (agentId && threadDbId) {
      try {
        const thread = await threadRepository.findById(threadDbId);
        if (thread && thread.userId.toString() === userId.toString()) {
          langGraphThreadId = thread.threadId;
          await threadRepository.touchLastMessageAt(thread._id);
        }
      } catch {
        // Fall back to default thread id
      }
    }

    requestStore.run({ userId, agentId, langGraphThreadId }, next);
  } catch (err) {
    next(err);
  }
});

// Singleton runtime — agent factory reads per-request context from AsyncLocalStorage
const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      type: 'custom',
      factory: async (ctx) => {
        const store = requestStore.getStore();
        const { agentId, userId, langGraphThreadId } = store || {};

        const messageId = randomUUID();

        if (!agentId) {
          async function* missingAgent() {
            yield { type: EventType.TEXT_MESSAGE_START, messageId };
            yield {
              type: EventType.TEXT_MESSAGE_CONTENT,
              messageId,
              delta: '*(Error: agentId query param is required)*',
            };
            yield { type: EventType.TEXT_MESSAGE_END, messageId };
          }
          return missingAgent();
        }

        const messages = ctx.input?.messages ?? [];
        const lastHuman = [...messages].reverse().find((m) => m.role === 'user');
        const content =
          typeof lastHuman?.content === 'string'
            ? lastHuman.content
            : (lastHuman?.content?.[0]?.text ?? '');

        const { agentInstance } = await agentFactory.buildAgent(
          agentId,
          userId,
          chatService.checkpointer,
        );

        async function* generateEvents() {
          let started = false;
          try {
            for await (const event of agentInstance.streamEvents(
              { messages: [new HumanMessage(content)] },
              { configurable: { thread_id: langGraphThreadId }, version: 'v2' },
            )) {
              if (event.event === 'on_chat_model_stream') {
                const chunk = event.data?.chunk?.content;
                if (typeof chunk === 'string' && chunk) {
                  if (!started) {
                    yield { type: EventType.TEXT_MESSAGE_START, messageId };
                    started = true;
                  }
                  yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: chunk };
                }
              }
            }
          } catch (err) {
            const isInterrupt =
              err?.name === 'GraphInterrupt' || err?.message?.includes('interrupt');
            const notice = isInterrupt
              ? '\n\n*(Agent paused for clarification. Interrupt-based tools are not yet supported in this chat mode.)*'
              : `\n\n*(Error: ${err?.message || 'Unknown error'})*`;
            if (!started) {
              yield { type: EventType.TEXT_MESSAGE_START, messageId };
            }
            yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: notice };
          } finally {
            if (started) {
              yield { type: EventType.TEXT_MESSAGE_END, messageId };
            }
          }
        }

        return generateEvents();
      },
    }),
  },
});

// Mount the v2 AG-UI handler — basePath '/' matches all sub-paths under /api/v1/copilotkit
copilotRouter.use(
  createCopilotExpressHandler({
    runtime,
    basePath: '/',
    cors: false, // CORS is handled by the global Express cors() middleware
  }),
);

export default copilotRouter;
