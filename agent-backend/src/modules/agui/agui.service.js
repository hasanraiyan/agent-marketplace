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
import { traceService, TRACE_STATUS } from '../traces/index.js';
import {
  AttachmentError,
  attachmentSubject,
  buildHumanContent,
  droppedAttachmentNotice,
  getLastUserMessage,
  parseUserContent,
  resolveUserImages,
} from './userContent.js';
import fileService from '../files/file.service.js';
import BaseError from '../../utils/errors/BaseError.js';

const logger = loggerService.getLogger();

/**
 * Read the raw JSON body from the request, parsing the stream manually
 * (AGUI reads its own body before express.json() consumes it).
 */
// Room for the largest valid image turn (4 × 5 MB inline images as base64 ≈
// 27 MB) plus text; anything bigger is rejected before it's buffered.
export const MAX_AGUI_BODY_BYTES = 32 * 1024 * 1024;

export async function readJsonBody(req, { maxBytes = MAX_AGUI_BODY_BYTES } = {}) {
  if (req.body && typeof req.body === 'object') return req.body;

  const declared = Number(req.headers?.['content-length']);
  if (declared > maxBytes)
    throw new BaseError('Request body is too large', 413, 'PAYLOAD_TOO_LARGE');

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes)
      throw new BaseError('Request body is too large', 413, 'PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
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
 * HumanMessage content for a new turn: the text, plus image references when
 * images are allowed. When they aren't (setting off, non-web channel), the
 * images are dropped and the model gets a one-line note instead. Throws
 * AttachmentError for an invalid image (the whole turn is rejected).
 */
export async function buildTurnContent({
  lastUserMessage,
  text,
  imagesAllowed,
  subject,
  agentId,
  threadKey,
  resolve = resolveUserImages,
  bind = (ids, key) => fileService.bindAttachmentsToThread(ids, key),
}) {
  const { images, unsupported } = parseUserContent(lastUserMessage?.content);
  if (images.length === 0 && unsupported.length === 0) return text;

  if (!imagesAllowed) {
    const notice = droppedAttachmentNotice({ images: images.length, unsupported });
    return text ? `${text}\n\n${notice}` : notice;
  }

  const refs = await resolve(images, { subject, agentId });
  await bind(
    refs.map((r) => r.fileId),
    threadKey
  );
  const notice = droppedAttachmentNotice({ unsupported });
  const withNotice = notice ? (text ? `${text}\n\n${notice}` : notice) : text;
  return buildHumanContent(withNotice, refs);
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
  turnContext,
  signal,
  executionContext = personaExecutionContext(userId),
  allowPrivateExecution = false,
  // Client-supplied tools that run in the browser (AG-UI `RunAgentInput.tools`).
  // Validated and gated on the Agent's `frontendToolsEnabled` in agent.factory.js.
  frontendTools,
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

  // Fetch thread if threadDbId or langGraphThreadId exists to check if auto-titling is required
  let thread = null;
  const lookupThreadId = threadDbId || langGraphThreadId;
  if (lookupThreadId) {
    try {
      thread = await threadRepository.findById(lookupThreadId);
    } catch (err) {
      logger.warn('[AG-UI] failed to fetch thread for auto-titling', {
        threadDbId: lookupThreadId,
        err: err.message,
      });
    }
  }

  // Frontend tools need a browser to run in: voice/SMS/WhatsApp turns never
  // get them, even if a caller forwarded some.
  const turnChannel =
    turnContext?.channel || messages?.findLast?.((m) => m?.role === 'user')?.channel;
  const effectiveFrontendTools =
    Array.isArray(frontendTools) &&
    frontendTools.length > 0 &&
    (!turnChannel || turnChannel === 'web')
      ? frontendTools
      : undefined;

  let agentBuild;
  try {
    agentBuild = await agentFactory.buildAgent(
      agentId,
      userId,
      checkpointService.checkpointer,
      executionContext,
      { allowPrivateExecution, frontendTools: effectiveFrontendTools }
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

  const {
    agentInstance,
    agentConfig,
    providerConfig,
    llm,
    mcpAppMap,
    mcpAuthRequired = [],
  } = agentBuild;

  // User-mode MCP connectors this end user hasn't connected: their tools were
  // dropped from the agent's toolset at build time. Emit the list up front so
  // the client can offer a "Connect" affordance instead of silently missing
  // capabilities. Sent on resume too — the connection may have died since the
  // interrupt, and the build is re-run (and invalidated on connect/disconnect).
  if (mcpAuthRequired.length > 0) {
    logger.info('[AG-UI] user-mode MCP auth required', {
      agentId,
      mcpIds: mcpAuthRequired.map((s) => s.mcpId),
    });
    yield {
      type: EventType.CUSTOM,
      name: 'mcp_auth_required',
      value: { servers: mcpAuthRequired },
    };
  }

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

  // Images on the user's message (Agent `imageInputEnabled`, web turns only):
  // validated, stored, and referenced by file id — see userContent.js. A
  // resume carries no new user message, so nothing to do there.
  let humanContent = content;
  if (!isResuming) {
    try {
      humanContent = await buildTurnContent({
        lastUserMessage: getLastUserMessage(messages),
        text: content,
        imagesAllowed:
          Boolean(agentConfig?.imageInputEnabled) && (!turnChannel || turnChannel === 'web'),
        subject: attachmentSubject(executionContext, userId),
        agentId,
        threadKey: langGraphThreadId,
      });
    } catch (err) {
      if (!(err instanceof AttachmentError)) throw err;
      logger.info('[AG-UI] run rejected: invalid attachment', { agentId, reason: err.message });
      yield {
        type: EventType.RUN_ERROR,
        code: err.code,
        message: err.message,
        retryable: false,
      };
      return;
    }
  }

  // Trigger concurrent auto-titling if this is a fresh conversation with default title
  const DEFAULT_TITLES = [
    'New Conversation',
    'New Chat',
    'Main Chat',
    'Untitled',
    'Default Thread',
  ];
  const isDefaultTitle = thread && DEFAULT_TITLES.includes(thread.title?.trim());
  let titlePromise = null;
  if (isDefaultTitle && !isResuming && content) {
    titlePromise = checkpointService._autoTitleThread(thread, content, llm);
  }

  const messageChannel =
    turnContext?.channel || messages?.findLast?.((m) => m?.role === 'user')?.channel;

  const resumeValue = isResuming ? buildResumeValue(pendingInterrupt, resume, content) : undefined;
  const inputArg = isResuming
    ? new Command({ resume: resumeValue })
    : {
        messages: [
          new HumanMessage({
            content: humanContent,
            additional_kwargs: messageChannel ? { channel: messageChannel } : {},
          }),
        ],
      };

  // Records run ancestry alongside the event stream so the translator can
  // attribute nested events to the correct `task` (subagent) call even when
  // several subagents run in parallel.
  const runScopeTracker = new RunScopeTracker();

  // Built-in tracing (Developer Platform Projects only — see trace.service.js):
  // records every LLM/tool/subagent step for the platform's Traces page.
  // Fail-soft: null when disabled, and its DB writes never throw into the run.
  const traceInput = (() => {
    if (typeof humanContent === 'string' && humanContent) return humanContent;
    if (Array.isArray(humanContent)) {
      const text = humanContent.find((p) => p?.type === 'text')?.text || '';
      const images = humanContent.filter((p) => p?.type === 'image');
      if (images.length > 0) {
        const labels = images
          .map((img) => `[image: ${img.name || img.mimeType || 'image'}]`)
          .join(' ');
        return text ? `${text} ${labels}` : labels;
      }
      if (text) return text;
    }
    return content;
  })();

  const trace = traceService.begin({
    executionContext,
    agentId,
    agentConfig,
    providerConfig,
    threadId: threadDbId || thread?._id || langGraphThreadId,
    channel: turnChannel || 'web',
    input: traceInput,
    // A resumed run is its own trace, linked to the paused one, and records
    // the human's decision (approve/reject/edit, answers, client tool results).
    resume: isResuming ? { pending: pendingInterrupt, value: resumeValue } : undefined,
  });
  if (trace && executionContext?.principalType === 'ProjectAdmin') {
    // Lets the platform playground link straight to this run's trace.
    // Admin (playground) runs only — not part of the public AG-UI catalog.
    yield { type: EventType.CUSTOM, name: 'trace_started', value: { traceId: trace.traceId } };
  }

  const stream = agentInstance.streamEvents(inputArg, {
    // contextOverride/turnContext ride here, not inputArg.messages:
    // `configurable` is per-invocation RunnableConfig, never persisted by
    // the checkpointer as durable thread state (see contextOverrideMiddleware
    // in agent.factory.js). turnContext follows the exact same channel for
    // the exact same reason (TURN_CONTEXT_RCP_RESOLVERS_PLAN.md) — an RCP
    // tool built from a cached agent must still read this turn's real data,
    // never whatever turn happened to be live when the tool was built.
    configurable: { thread_id: langGraphThreadId, contextOverride, turnContext },
    version: 'v2',
    signal,
    callbacks: trace ? [runScopeTracker, trace.recorder] : [runScopeTracker],
  });

  let pausedForInterrupt = false;
  let runError = null;
  let completed = false;
  let lastInterrupt = null;
  const translated = translateLangGraphStream(stream, {
    providerConfig,
    logger,
    mcpAppMap,
    runScopeTracker,
    suppressArgStreamingFor: guardedToolNames,
    // Resuming paused frontend tools re-runs their stubs; the client already
    // shows those calls with the results it produced — don't duplicate them.
    replayedToolCalls:
      isResuming && pendingInterrupt?.kind === 'frontend_tool'
        ? pendingInterrupt.calls.map((c) => c.name)
        : undefined,
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
      lastInterrupt = interruptInfo;
    },
    onError: (leaves, err) => {
      runError = err?.message || 'Agent run failed';
      logger.error(`[AG-UI] stream failed: ${err?.name || 'Error'}: ${err?.message}`, {
        agentId,
        leafCount: leaves.length,
        leaves: leaves.map((e) => ({ name: e?.name, message: e?.message, stack: e?.stack })),
      });
    },
  });

  try {
    for await (const event of translated) {
      if (event?.type === EventType.RUN_ERROR && !runError) {
        runError = event.message || 'Agent run failed';
      }
      yield event;
    }
    completed = true;
  } catch (err) {
    runError = runError || err?.message || 'Agent run failed';
    throw err;
  } finally {
    if (trace) {
      let status = TRACE_STATUS.SUCCESS;
      if (runError) status = TRACE_STATUS.ERROR;
      else if (signal?.aborted || !completed) status = TRACE_STATUS.CANCELLED;
      else if (pausedForInterrupt) status = TRACE_STATUS.INTERRUPTED;
      // Not awaited: persisting the trace must not hold up the response.
      void trace.finish({
        status,
        error: runError,
        interrupt: status === TRACE_STATUS.INTERRUPTED ? lastInterrupt : null,
      });
    }
  }

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
