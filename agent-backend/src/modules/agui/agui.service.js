import { EventType } from '@ag-ui/core';
import { HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import agentFactory from '../agents/agent.factory.js';
import { personaExecutionContext } from '../agents/agent.service.js';
import threadRepository from '../threads/thread.repository.js';
import checkpointService from '../threads/checkpoint.service.js';
import { loggerService } from '../../utils/index.js';
import {
  translateLangGraphStream,
  emitTextNotice,
  formatRuntimeError,
  classifyRuntimeError,
  buildResumeValue,
  describeInterrupt,
} from './aguiTranslator.js';
import { RunScopeTracker } from './RunScopeTracker.js';

const logger = loggerService.getLogger();

/**
 * Read the raw JSON body from the request, parsing the stream manually
 * (AGUI reads its own body before express.json() consumes it).
 */
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

/**
 * Extracts the last user message text from a messages array,
 * handling both string and structured content.
 */
export function getLastUserText(messages) {
  const lastHuman = [...(messages || [])].reverse().find((message) => message.role === 'user');
  const content = lastHuman?.content;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
  }
  return '';
}

/**
 * Core AGUI event stream generator — builds the agent from its factory,
 * checks for pending interrupts, auto-titles threads, runs the LangGraph
 * stream through the translator, and emits AGUI events.
 *
 * Developer Platform (blueprint Phase 8, PR-23a): `executionContext` is
 * forwarded to `agentFactory.buildAgent` as-is; it defaults to
 * `personaExecutionContext(userId)`, so the existing Persona AG-UI route
 * (which already passes it explicitly, PR-21) and any caller that omits it
 * get identical behavior. The Developer AG-UI route passes a
 * `ProjectRuntimeContext` here instead.
 */
export async function* runAgentAsAguiEvents({
  agentId,
  userId,
  langGraphThreadId,
  threadDbId,
  messages,
  resume,
  contextOverride,
  signal,
  executionContext = personaExecutionContext(userId),
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
    agentBuild = await agentFactory.buildAgent(
      agentId,
      userId,
      checkpointService.checkpointer,
      executionContext
    );
  } catch (err) {
    logger.error(`[AG-UI] agent build failed: ${err?.message}`, { agentId });
    const { code, retryable, providerName } = classifyRuntimeError(err);
    yield {
      type: EventType.RUN_ERROR,
      code,
      message: formatRuntimeError(err),
      retryable,
      providerName,
    };
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
    // contextOverride rides here, not inputArg.messages: `configurable` is
    // per-invocation RunnableConfig, never persisted by the checkpointer as
    // durable thread state (see contextOverrideMiddleware in agent.factory.js).
    configurable: { thread_id: langGraphThreadId, contextOverride },
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
