import express from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { CopilotRuntime, BuiltInAgent } from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';
import { HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import authMiddleware from '../middlewares/auth.middleware.js';
import agentFactory from '../factories/agentFactory.js';
import threadRepository from '../repositories/threadRepository.js';
import chatService from '../services/chat.service.js';
import { loggerService } from '../utils/index.js';
import {
  translateLangGraphStream,
  emitTextNotice,
  formatRuntimeError,
} from '../utils/aguiTranslator.js';

const logger = loggerService.getLogger();

// Tracks threads currently paused at an interrupt (ask_clarification, etc.)
// Key: langGraphThreadId, Value: { timestamp }
const interruptedThreads = new Map();
// Clean up stale interrupt entries every 5 min (TTL = 30 min)
setInterval(
  () => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [k, v] of interruptedThreads) {
      if (v.timestamp < cutoff) interruptedThreads.delete(k);
    }
  },
  5 * 60 * 1000
).unref();

// Carries per-request { userId, agentId, langGraphThreadId } through the async chain
const requestStore = new AsyncLocalStorage();

const copilotRouter = express.Router();

// The LangGraph -> AG-UI event translation and error/interrupt helpers live in
// ../utils/aguiTranslator.js (extracted + unit-tested). See that file for why we
// translate in-process instead of using the official (deploy-only) @ag-ui/langgraph.

// Auth + context injection. Skip OPTIONS so CopilotKit's built-in CORS preflight works.
copilotRouter.use(async (req, res, next) => {
  console.log(`[CopilotKit] Incoming ${req.method} request to: ${req.originalUrl}`);

  if (req.method === 'OPTIONS') return next();

  try {
    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err) => (err ? reject(err) : resolve()));
    });

    const userId = req.user._id;
    console.log(`[CopilotKit] Auth successful for user: ${userId}`);
    // Custom headers carry agentId/threadId so the runtimeUrl stays query-param-free.
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

// Singleton runtime: agent factory reads per-request context from AsyncLocalStorage.
const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      type: 'custom',
      factory: async (ctx) => {
        const store = requestStore.getStore();
        const { agentId, userId, langGraphThreadId } = store || {};

        if (!agentId) {
          logger.warn('[CopilotKit] run rejected: missing agentId');
          return emitTextNotice('*(Error: agentId query param is required)*');
        }

        const messages = ctx.input?.messages ?? [];
        const lastHuman = [...messages].reverse().find((m) => m.role === 'user');
        const content =
          typeof lastHuman?.content === 'string'
            ? lastHuman.content
            : (lastHuman?.content?.[0]?.text ?? '');

        logger.info('[CopilotKit] run requested', {
          agentId,
          userId: String(userId ?? ''),
          threadId: langGraphThreadId,
          messageCount: messages.length,
          contentLength: content.length,
        });

        let agentBuild;
        try {
          agentBuild = await agentFactory.buildAgent(agentId, userId, chatService.checkpointer);
        } catch (err) {
          logger.error(`[CopilotKit] agent build failed: ${err?.message}`, { agentId });
          return emitTextNotice(`*(Error: ${formatRuntimeError(err)})*`);
        }

        const { agentInstance, providerConfig, skillFiles } = agentBuild;

        // Detect resume: thread was paused at an interrupt and user just replied
        const isResuming = langGraphThreadId != null && interruptedThreads.has(langGraphThreadId);
        if (isResuming) interruptedThreads.delete(langGraphThreadId);

        const hasSkillFiles = skillFiles && Object.keys(skillFiles).length > 0;

        logger.info('[CopilotKit] agent ready', {
          agentId,
          model: providerConfig?.modelName,
          cacheHit: Boolean(agentBuild.cacheHit),
          resuming: isResuming,
          skillCount: hasSkillFiles ? Object.keys(skillFiles).length : 0,
        });
        const inputArg = isResuming
          ? new Command({ resume: content })
          : {
              messages: [new HumanMessage(content)],
              // Seed the agent's skills into the StateBackend virtual filesystem so the
              // skills middleware can discover them (it scans /skills/). The files reducer
              // merges by path, so re-seeding every fresh turn is idempotent and won't
              // clobber files the agent wrote earlier. On resume we send a Command (no
              // files) — they already persist in thread state via the checkpointer.
              ...(hasSkillFiles ? { files: skillFiles } : {}),
            };

        const stream = agentInstance.streamEvents(inputArg, {
          configurable: { thread_id: langGraphThreadId },
          version: 'v2',
        });

        // All LangGraph -> AG-UI translation, interrupt detection and error
        // unwrapping lives in the tested translator module.
        return translateLangGraphStream(stream, {
          providerConfig,
          logger,
          // Lets the translator emit a STATE_SNAPSHOT of the virtual filesystem +
          // todos at end-of-turn so the client's Files panel can mirror them. Reads
          // authoritative persisted channel values from the checkpointer.
          getState: langGraphThreadId
            ? async () => {
                const snap = await agentInstance.getState({
                  configurable: { thread_id: langGraphThreadId },
                });
                return snap?.values;
              }
            : undefined,
          onInterrupt: () => {
            // Persist interrupted state so the user's next message triggers a resume.
            if (langGraphThreadId)
              interruptedThreads.set(langGraphThreadId, { timestamp: Date.now() });
          },
          onError: (leaves, err) => {
            logger.error(`[CopilotKit] Stream failed: ${err?.name || 'Error'}: ${err?.message}`, {
              agentId,
              leafCount: leaves.length,
              leaves: leaves.map((e) => ({ name: e?.name, message: e?.message, stack: e?.stack })),
            });
          },
        });
      },
    }),
  },
});

// Some client flows probe the bare mounted runtime URL before calling /info.
// Rewrite those requests in-place so auth headers and middleware context stay intact.
copilotRouter.get('/', (req, res, next) => {
  req.url = '/info';
  next();
});

// Keep the runtime relative to its mounted Express base path.
copilotRouter.use(
  createCopilotExpressHandler({
    runtime,
    basePath: '/',
    cors: false, // CORS is handled by the global Express cors() middleware
  })
);

export { runtime, requestStore, interruptedThreads };
export default copilotRouter;
