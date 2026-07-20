import express from 'express';
import crypto from 'crypto';
import { EventType } from '@ag-ui/core';
import { HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import authMiddleware from '../modules/auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../middlewares/rateLimiter.middleware.js';
import rateLimiterService from '../services/rateLimiter.service.js';
import RateLimitError from '../utils/errors/RateLimitError.js';
import agentFactory from '../modules/agents/agent.factory.js';
import threadRepository from '../modules/threads/thread.repository.js';
import checkpointService from '../modules/threads/checkpoint.service.js';
import { loggerService } from '../utils/index.js';
import {
  translateLangGraphStream,
  emitTextNotice,
  formatRuntimeError,
  buildResumeValue,
  describeInterrupt,
} from '../utils/aguiTranslator.js';
import { RunScopeTracker } from '../utils/RunScopeTracker.js';
import { foldSubagentEvent, settleTrace } from '../utils/subagentTrace.js';

const logger = loggerService.getLogger();
const aguiRouter = express.Router();

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
    return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
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

    req.aguiContext = { userId, agentId, langGraphThreadId, threadDbId };
    next();
  } catch (err) {
    next(err);
  }
});

async function* runAgentAsAguiEvents({
  agentId,
  userId,
  langGraphThreadId,
  threadDbId,
  messages,
  resume,
  signal,
}) {
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

  // Fetch thread if threadDbId exists to check if auto-titling is required
  let thread = null;
  if (threadDbId) {
    try {
      thread = await threadRepository.findById(threadDbId);
    } catch (err) {
      logger.warn('[AG-UI] failed to fetch thread for auto-titling', {
        threadDbId,
        err: err.message,
      });
    }
  }

  let agentBuild;
  try {
    agentBuild = await agentFactory.buildAgent(agentId, userId, checkpointService.checkpointer);
  } catch (err) {
    logger.error(`[AG-UI] agent build failed: ${err?.message}`, { agentId });
    yield* emitTextNotice(`*(Error: ${formatRuntimeError(err)})*`);
    return;
  }

  const { agentInstance, agentConfig, providerConfig, llm, mcpAppMap } = agentBuild;

  // HITL-guarded tools: the graph pauses before executing these, so their args
  // must not be live-streamed (the card would be stranded "running" across the
  // interrupt). They surface at on_tool_start after the user approves instead.
  const interruptOnEntries =
    agentConfig?.interruptOn instanceof Map
      ? [...agentConfig.interruptOn.entries()]
      : Object.entries(agentConfig?.interruptOn || {});
  const guardedToolNames = interruptOnEntries
    .filter(([, enabled]) => Boolean(enabled))
    .map(([name]) => name);

  let pendingInterrupt;
  if (langGraphThreadId) {
    try {
      const state = await agentInstance.getState({
        configurable: { thread_id: langGraphThreadId },
      });
      // snapshot.tasks[].interrupts holds any pending pauses
      const interrupts = (state?.tasks || []).flatMap((t) => t.interrupts || []);
      if (interrupts.length > 0) {
        pendingInterrupt = describeInterrupt(interrupts);
      }
    } catch (err) {
      logger.warn('[AG-UI] failed to check graph state for interrupts', {
        langGraphThreadId,
        err: err.message,
      });
    }
  }

  const isResuming = Boolean(pendingInterrupt);

  // Trigger concurrent auto-titling if this is a fresh conversation with default title
  let titlePromise = null;
  if (thread && thread.title === 'New Conversation' && !isResuming && content) {
    titlePromise = checkpointService._autoTitleThread(thread, content, llm);
  }

  const inputArg = isResuming
    ? new Command({ resume: buildResumeValue(pendingInterrupt, resume, content) })
    : { messages: [new HumanMessage(content)] };

  // Records run ancestry alongside the event stream so the translator can
  // attribute nested events to the correct `task` (subagent) call even when
  // several subagents run in parallel.
  const runScopeTracker = new RunScopeTracker();

  const stream = agentInstance.streamEvents(inputArg, {
    configurable: { thread_id: langGraphThreadId },
    version: 'v2',
    signal,
    callbacks: [runScopeTracker],
  });

  let pausedForInterrupt = false;
  yield* translateLangGraphStream(stream, {
    providerConfig,
    logger,
    mcpAppMap,
    runScopeTracker,
    suppressArgStreamingFor: guardedToolNames,
    getState: langGraphThreadId
      ? async () => {
          const snap = await agentInstance.getState({
            configurable: { thread_id: langGraphThreadId },
          });
          return snap?.values;
        }
      : undefined,
    onInterrupt: (interruptInfo) => {
      if (signal?.aborted) return;
      pausedForInterrupt = true;
    },
    onError: (leaves, err) => {
      logger.error(`[AG-UI] stream failed: ${err?.name || 'Error'}: ${err?.message}`, {
        agentId,
        leafCount: leaves.length,
        leaves: leaves.map((e) => ({ name: e?.name, message: e?.message, stack: e?.stack })),
      });
    },
  });

  if (titlePromise && !pausedForInterrupt) {
    try {
      const newTitle = await titlePromise;
      if (newTitle) {
        yield { type: 'title', title: newTitle };
      }
    } catch (err) {
      logger.error(`[AG-UI] auto titling failed: ${err?.message}`);
    }
  }
}

aguiRouter.get('/', (req, res) => {
  res.json({
    protocol: 'ag-ui',
    transport: 'sse',
    status: 'ok',
  });
});

aguiRouter.post('/', rateLimiter('CHAT', RATE_LIMITS.CHAT), async (req, res, next) => {
  const context = req.aguiContext || {};
  const identifier = context.userId || req.ip;
  const concurrencyKey = `concurrency:CHAT:${identifier}`;

  if (rateLimiterService.getConcurrency(concurrencyKey) >= 2) {
    return next(new RateLimitError(30));
  }

  rateLimiterService.incrementConcurrency(concurrencyKey);

  try {
    const input = await readJsonBody(req);
    const threadId = input.threadId || context.langGraphThreadId || 'default';
    const runId = input.runId || crypto.randomUUID();

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    const send = (event) => {
      if (res.destroyed) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Subagent timelines exist only in the live stream (checkpoints hold just
    // the main thread's messages) — fold them here and persist per task call
    // so the subagent's transcript survives thread reloads.
    const subagentTraces = {};

    send({ type: EventType.RUN_STARTED, threadId, runId });
    for await (const event of runAgentAsAguiEvents({
      ...context,
      messages: input.messages || [],
      resume: input.resume,
      signal: controller.signal,
    })) {
      if (res.destroyed) break;
      if (event?.type === EventType.CUSTOM && event.name === 'subagent_activity') {
        const callId = event.value?.toolCallId;
        if (callId) {
          foldSubagentEvent((subagentTraces[callId] ??= []), event.value);
        }
      }
      send(event);
    }
    send({ type: EventType.RUN_FINISHED, threadId, runId });
    res.end();

    if (context.threadDbId && Object.keys(subagentTraces).length > 0) {
      // Per-key $set merges this run's traces with earlier turns' instead of
      // replacing the whole map. Fire-and-forget — persistence must not
      // delay or fail the response.
      const setOps = {};
      for (const [callId, items] of Object.entries(subagentTraces)) {
        setOps[`subagentTraces.${callId}`] = settleTrace(items);
      }
      threadRepository
        .update(context.threadDbId, { $set: setOps })
        .catch((err) =>
          logger.warn('[AG-UI] failed to persist subagent traces', { err: err.message })
        );
    }
  } catch (err) {
    next(err);
  } finally {
    rateLimiterService.decrementConcurrency(concurrencyKey);
  }
});

export default aguiRouter;
