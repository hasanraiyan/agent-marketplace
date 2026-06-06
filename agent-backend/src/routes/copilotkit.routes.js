import express from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { CopilotRuntime, BuiltInAgent } from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';
import { EventType } from '@ag-ui/core';
import { HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { randomUUID } from 'crypto';
import authMiddleware from '../middlewares/auth.middleware.js';
import agentFactory from '../factories/agentFactory.js';
import threadRepository from '../repositories/threadRepository.js';
import chatService from '../services/chat.service.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

// Tracks threads currently paused at an interrupt (ask_clarification, etc.)
// Key: langGraphThreadId, Value: { timestamp }
const interruptedThreads = new Map();
// Clean up stale interrupt entries every 5 min (TTL = 30 min)
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [k, v] of interruptedThreads) {
    if (v.timestamp < cutoff) interruptedThreads.delete(k);
  }
}, 5 * 60 * 1000).unref();

// Carries per-request { userId, agentId, langGraphThreadId } through the async chain
const requestStore = new AsyncLocalStorage();

const copilotRouter = express.Router();

// Recursively find LangGraph interrupt payloads from GraphInterrupt or
// MultipleErrors (which wraps GraphInterrupt on err.errors[N].interrupts).
function extractGraphInterrupts(err) {
  if (!err) return null;
  if (Array.isArray(err.interrupts) && err.interrupts.length > 0) return err.interrupts;
  if (Array.isArray(err.errors)) {
    for (const inner of err.errors) {
      const found = extractGraphInterrupts(inner);
      if (found) return found;
    }
  }
  if (err.cause) return extractGraphInterrupts(err.cause);
  return null;
}

// LangGraph throws an AggregateError ("Multiple errors occurred during superstep N")
// when 2+ parallel tasks fail in the same step — the real causes live in err.errors[],
// not err.message. Flatten the whole tree (AggregateError.errors + .cause) into the
// individual leaf errors so they can be logged and surfaced.
function flattenErrors(err, seen = new Set()) {
  if (!err || seen.has(err)) return [];
  seen.add(err);
  const leaves = [];
  const children = [
    ...(Array.isArray(err.errors) ? err.errors : []),
    ...(err.cause ? [err.cause] : []),
  ];
  if (children.length === 0) {
    leaves.push(err);
  } else {
    for (const child of children) leaves.push(...flattenErrors(child, seen));
  }
  return leaves;
}

function formatRuntimeError(err, providerConfig) {
  const rawMessage = err?.message || 'Unknown error';
  const lower = rawMessage.toLowerCase();

  const isProviderAuthIssue =
    lower.includes('incorrect api key provided') ||
    lower.includes('model_authentication') ||
    (lower.includes('401') && lower.includes('api key'));

  if (isProviderAuthIssue) {
    const providerLabel = providerConfig?.label || 'this provider';
    return `Provider "${providerLabel}" has invalid credentials. Update its API key in Settings and try again.`;
  }

  return rawMessage;
}

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

        let agentBuild;
        try {
          agentBuild = await agentFactory.buildAgent(agentId, userId, chatService.checkpointer);
        } catch (err) {
          async function* buildFailure() {
            yield { type: EventType.TEXT_MESSAGE_START, messageId };
            yield {
              type: EventType.TEXT_MESSAGE_CONTENT,
              messageId,
              delta: `*(Error: ${formatRuntimeError(err)})*`,
            };
            yield { type: EventType.TEXT_MESSAGE_END, messageId };
          }
          return buildFailure();
        }

        const { agentInstance, providerConfig } = agentBuild;

        // Detect resume: thread was paused at an interrupt and user just replied
        const isResuming = langGraphThreadId != null && interruptedThreads.has(langGraphThreadId);
        if (isResuming) interruptedThreads.delete(langGraphThreadId);

        async function* generateEvents() {
          let currentTextMsgId = null;
          let textActive = false;
          const pendingToolCalls = new Map();

          try {
            const inputArg = isResuming
              ? new Command({ resume: content })
              : { messages: [new HumanMessage(content)] };

            for await (const event of agentInstance.streamEvents(
              inputArg,
              { configurable: { thread_id: langGraphThreadId }, version: 'v2' },
            )) {
              logger.debug(`[CopilotKit] Received event: ${event.event}`, { name: event.name || event.data?.name });
              // ── Text tokens ──────────────────────────────────────────────────
              if (event.event === 'on_chat_model_stream') {
                const text =
                  typeof event.data?.chunk?.content === 'string'
                    ? event.data.chunk.content
                    : '';
                if (text) {
                  if (!textActive) {
                    currentTextMsgId = randomUUID();
                    textActive = true;
                    yield { type: EventType.TEXT_MESSAGE_START, messageId: currentTextMsgId };
                  }
                  yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId: currentTextMsgId, delta: text };
                }
              }

              // ── Tool call starts ─────────────────────────────────────────────
              else if (event.event === 'on_tool_start') {
                // Skip internal sub-tool calls (e.g. TavilySearch invoked inside the
                // search_web wrapper). The model never called these, so emitting AG-UI
                // tool events for them corrupts the message stream. The matching
                // on_tool_end is ignored automatically (never added to pendingToolCalls).
                if (event.tags?.includes('internal:nested-tool')) {
                  continue;
                }

                // Close any open text message before emitting tool events
                if (textActive) {
                  textActive = false;
                  yield { type: EventType.TEXT_MESSAGE_END, messageId: currentTextMsgId };
                }

                const toolCallId = event.run_id;
                const toolName = event.name;
                const toolInput = event.data?.input;

                pendingToolCalls.set(toolCallId, { name: toolName });

                // parentMessageId is `z.string().optional()` in @ag-ui/core — an explicit
                // `null` fails validation and aborts the whole stream. When the model calls
                // a tool with no preceding text, currentTextMsgId is null, so omit the field.
                const toolCallStart = {
                  type: EventType.TOOL_CALL_START,
                  toolCallId,
                  toolCallName: toolName,
                };
                if (currentTextMsgId) toolCallStart.parentMessageId = currentTextMsgId;
                yield toolCallStart;
                const argsStr =
                  typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput ?? {});
                yield { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: argsStr };
                yield { type: EventType.TOOL_CALL_END, toolCallId };
              }

              // ── Tool call result ─────────────────────────────────────────────
              else if (event.event === 'on_tool_end') {
                const tc = pendingToolCalls.get(event.run_id);
                if (tc) {
                  pendingToolCalls.delete(event.run_id);
                  const resultMsgId = randomUUID();
                  const output = event.data?.output;
                  const resultContent =
                    typeof output === 'string' ? output : JSON.stringify(output ?? '');
                  yield {
                    type: EventType.TOOL_CALL_RESULT,
                    messageId: resultMsgId,
                    toolCallId: event.run_id,
                    content: resultContent,
                    role: 'tool',
                  };
                }
              }
            }
          } catch (err) {
            const graphInterrupts = extractGraphInterrupts(err);
            const isInterrupt =
              graphInterrupts != null ||
              err?.name === 'GraphInterrupt' ||
              err?.message?.toLowerCase().includes('interrupt');

            // Surface the REAL underlying failures. AggregateError ("Multiple errors
            // occurred during superstep N") hides the actual tool errors in err.errors[],
            // so without this they never reach the logs.
            if (!isInterrupt) {
              const leaves = flattenErrors(err);
              logger.error(`[CopilotKit] Stream failed: ${err?.name || 'Error'}: ${err?.message}`, {
                agentId,
                leafCount: leaves.length,
                leaves: leaves.map((e) => ({
                  name: e?.name,
                  message: e?.message,
                  stack: e?.stack,
                })),
              });
            }

            let notice;

            if (isInterrupt && langGraphThreadId) {
              // Persist interrupted state so next message triggers a resume
              interruptedThreads.set(langGraphThreadId, { timestamp: Date.now() });

              // Extract structured questions if the interrupt carried them
              const interruptValue = (graphInterrupts ?? err?.interrupts)?.[0]?.value;
              const questions = interruptValue?.questions;

              if (Array.isArray(questions) && questions.length > 0) {
                const lines = questions.map((q, i) => {
                  const opts = (q.options || [])
                    .map((o, j) => `  ${String.fromCharCode(97 + j)}) ${o}`)
                    .join('\n');
                  return `**${i + 1}. ${q.text}**${opts ? '\n' + opts : ''}`;
                });
                notice =
                  `I need a bit more information before I continue:\n\n${lines.join('\n\n')}\n\n` +
                  `Reply with your answer and I'll pick up right where I left off.`;
              } else {
                notice = 'I need your input to continue. Please reply with your answer.';
              }
            } else {
              // Unwrap AggregateError so the user sees the first real cause, not the
              // "Multiple errors occurred during superstep N" wrapper.
              const leaves = flattenErrors(err);
              const rootCause = leaves.find((e) => e?.message) || err;
              notice = `\n\n*(Error: ${formatRuntimeError(rootCause, providerConfig)})*`;
            }

            if (!textActive) {
              currentTextMsgId = randomUUID();
              textActive = true;
              yield { type: EventType.TEXT_MESSAGE_START, messageId: currentTextMsgId };
            }
            yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId: currentTextMsgId, delta: notice };
          } finally {
            if (textActive) {
              yield { type: EventType.TEXT_MESSAGE_END, messageId: currentTextMsgId };
            }
          }
        }

        return generateEvents();
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
  }),
);

export { runtime, requestStore, interruptedThreads };
export default copilotRouter;
