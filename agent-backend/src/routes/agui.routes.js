import express from 'express';
import { EventType } from '@ag-ui/core';
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
const aguiRouter = express.Router();

const interruptedThreads = new Map();
setInterval(
  () => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [key, value] of interruptedThreads) {
      if (value.timestamp < cutoff) interruptedThreads.delete(key);
    }
  },
  5 * 60 * 1000
).unref();

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function getLastUserText(messages) {
  const lastHuman = [...(messages || [])].reverse().find((message) => message.role === 'user');
  const content = lastHuman?.content;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }
  return '';
}

aguiRouter.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  try {
    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err) => (err ? reject(err) : resolve()));
    });

    const userId = req.user._id;
    const agentId = req.headers['x-agent-id'] || req.query.agentId;
    const threadDbId = req.headers['x-thread-id'] || req.query.threadId;

    let langGraphThreadId = agentId ? `agui-${agentId}-${userId}` : null;
    if (agentId && threadDbId) {
      try {
        const thread = await threadRepository.findById(threadDbId);
        if (thread && thread.userId.toString() === userId.toString()) {
          langGraphThreadId = thread.threadId;
          await threadRepository.touchLastMessageAt(thread._id);
        }
      } catch {
        // Fall back to deterministic thread id.
      }
    }

    req.aguiContext = { userId, agentId, langGraphThreadId };
    next();
  } catch (err) {
    next(err);
  }
});

async function* runAgentAsAguiEvents({ agentId, userId, langGraphThreadId, messages }) {
  if (!agentId) {
    logger.warn('[AG-UI] run rejected: missing agentId');
    yield* emitTextNotice('*(Error: agentId header is required)*');
    return;
  }

  const content = getLastUserText(messages);
  logger.info('[AG-UI] run requested', {
    agentId,
    userId: String(userId ?? ''),
    threadId: langGraphThreadId,
    messageCount: messages?.length || 0,
    contentLength: content.length,
  });

  let agentBuild;
  try {
    agentBuild = await agentFactory.buildAgent(agentId, userId, chatService.checkpointer);
  } catch (err) {
    logger.error(`[AG-UI] agent build failed: ${err?.message}`, { agentId });
    yield* emitTextNotice(`*(Error: ${formatRuntimeError(err)})*`);
    return;
  }

  const { agentInstance, providerConfig, skillFiles } = agentBuild;
  const isResuming = langGraphThreadId != null && interruptedThreads.has(langGraphThreadId);
  if (isResuming) interruptedThreads.delete(langGraphThreadId);

  const hasSkillFiles = skillFiles && Object.keys(skillFiles).length > 0;
  const inputArg = isResuming
    ? new Command({ resume: content })
    : {
        messages: [new HumanMessage(content)],
        ...(hasSkillFiles ? { files: skillFiles } : {}),
      };

  const stream = agentInstance.streamEvents(inputArg, {
    configurable: { thread_id: langGraphThreadId },
    version: 'v2',
  });

  yield* translateLangGraphStream(stream, {
    providerConfig,
    logger,
    getState: langGraphThreadId
      ? async () => {
          const snap = await agentInstance.getState({
            configurable: { thread_id: langGraphThreadId },
          });
          return snap?.values;
        }
      : undefined,
    onInterrupt: () => {
      if (langGraphThreadId) interruptedThreads.set(langGraphThreadId, { timestamp: Date.now() });
    },
    onError: (leaves, err) => {
      logger.error(`[AG-UI] stream failed: ${err?.name || 'Error'}: ${err?.message}`, {
        agentId,
        leafCount: leaves.length,
        leaves: leaves.map((e) => ({ name: e?.name, message: e?.message, stack: e?.stack })),
      });
    },
  });
}

aguiRouter.get('/', (req, res) => {
  res.json({
    protocol: 'ag-ui',
    transport: 'sse',
    status: 'ok',
  });
});

aguiRouter.post('/', async (req, res, next) => {
  try {
    const input = await readJsonBody(req);
    const context = req.aguiContext || {};
    const threadId = input.threadId || context.langGraphThreadId || 'default';
    const runId = input.runId || `run-${Date.now()}`;

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    send({ type: EventType.RUN_STARTED, threadId, runId });
    for await (const event of runAgentAsAguiEvents({ ...context, messages: input.messages || [] })) {
      send(event);
    }
    send({ type: EventType.RUN_FINISHED, threadId, runId });
    res.end();
  } catch (err) {
    next(err);
  }
});

export { interruptedThreads };
export default aguiRouter;
