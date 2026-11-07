import type {
  ChatAttachmentInput,
  ChatMessageInput,
  ChatResume,
  FrontendToolDefinition,
} from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import { RunDriver } from '../runDriver.js';
import { withHeartbeats } from '../heartbeat.js';
import { parseFrontendTools, validateTurnContext } from '../routeHelpers.js';
import type { RunContext } from '../types/hooks.js';

interface ChatBody {
  agentId: string;
  messages: ChatMessageInput[];
  threadId?: string;
  resume?: ChatResume;
  contextOverride?: string;
  context?: Record<string, unknown>;
  tools?: FrontendToolDefinition[];
  attachments?: ChatAttachmentInput[];
}

// Same cap as the backend (IMAGE_ATTACHMENT_LIMITS.maxImagesPerMessage) —
// rejected here so an oversized request never reaches the API.
const MAX_ATTACHMENTS = 4;

/**
 * Images for this turn (`@personaai/react`'s useAttachments): ids of files
 * this same end user uploaded through `POST /files`. The backend checks
 * ownership, type and size, and ignores them unless the Agent has
 * `imageInputEnabled`.
 */
function parseAttachments(value: unknown): ChatAttachmentInput[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    !Array.isArray(value) ||
    !value.every(
      (a) =>
        typeof a === 'object' &&
        a !== null &&
        typeof a.fileId === 'string' &&
        a.fileId.length > 0 &&
        a.fileId.length <= 64
    )
  ) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"attachments" must be an array of { fileId } objects.'
    );
  }
  if (value.length > MAX_ATTACHMENTS) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      `At most ${MAX_ATTACHMENTS} attachments per message.`
    );
  }
  return value.length > 0
    ? value.map((a: { fileId: string }) => ({ fileId: a.fileId }))
    : undefined;
}


function parseChatBody(body: unknown): ChatBody {
  if (typeof body !== 'object' || body === null) {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', 'Request body must be a JSON object.');
  }
  const b = body as Record<string, unknown>;

  if (typeof b.agentId !== 'string' || b.agentId.length === 0) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"agentId" is required and must be a string.'
    );
  }
  if (!Array.isArray(b.messages)) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"messages" is required and must be an array.'
    );
  }

  return {
    agentId: b.agentId,
    messages: b.messages as ChatMessageInput[],
    threadId: typeof b.threadId === 'string' ? b.threadId : undefined,
    resume: (b.resume as ChatResume | undefined) ?? undefined,
    contextOverride: typeof b.contextOverride === 'string' ? b.contextOverride : undefined,
    // Distinct from contextOverride above — never shown to the model, only
    // ever read live by an RCP tool's resolver. validateTurnContext throws
    // a 400 on any shape violation (not a flat string/number/boolean
    // object, or over the byte cap) rather than coercing/dropping it.
    context: validateTurnContext(b.context),
    tools: parseFrontendTools(b.tools),
    attachments: parseAttachments(b.attachments),
  };
}

/**
 * Starts a new chat run. The run is driven by a `RunDriver` registered
 * under a fresh `runId` (returned via the `x-persona-run-id` response
 * header) independent of this specific HTTP response — if the connection
 * drops, `GET /chat/:runId/resume` can reattach to the same driver and pick
 * up where it left off. See `routes/chatResume.ts`.
 */
export const chatRoute: RouteHandler = async (request, ctx) => {
  const logger = ctx.logger.child('chat');
  logger.debug('chatRoute start', { userId: request.userId, hasBody: !!request.body });
  const body = parseChatBody(request.body);
  logger.trace('chatRoute body', {
    agentId: body.agentId,
    threadId: body.threadId,
    messageCount: body.messages?.length ?? 0,
    hasResume: !!body.resume,
    hasContextOverride: !!body.contextOverride,
    hasContext: !!body.context,
  });
  // `requiresAuth: true` guarantees request.userId is resolved by the time a route handler runs.
  const userId = request.userId as string;

  const runCtx: RunContext = {
    userId,
    kind: 'chat',
    agentId: body.agentId,
    threadId: body.threadId,
    messages: body.messages,
  };

  logger.debug('beforeRun hook', { agentId: body.agentId, threadId: body.threadId });
  await ctx.hooks?.beforeRun?.(runCtx);
  logger.trace('beforeRun completed', { agentId: body.agentId });

  logger.debug('starting chat stream', { agentId: body.agentId, threadId: body.threadId });
  const stream = ctx.client.chat.stream(body.agentId, {
    messages: body.messages,
    threadId: body.threadId,
    resume: body.resume,
    contextOverride: body.contextOverride,
    context: body.context,
    tools: body.tools,
    attachments: body.attachments,
  });

  const runId = crypto.randomUUID();
  logger.info('chat run created', {
    runId,
    agentId: body.agentId,
    threadId: body.threadId,
    userId,
  });
  const driver = new RunDriver(runId, runCtx, stream, ctx.hooks, ctx.mode);
  ctx.runs.set(runId, driver);
  logger.debug('run driver registered', { runId, trackedRuns: ctx.runs.size });

  // Rejects only if the very first upstream call failed before producing
  // any frame at all — nothing has been buffered yet, so bubbling this up
  // (through runtime.ts's centralized error mapping) to a clean buffered
  // error response is correct; there's no partial stream to preserve.
  try {
    await driver.waitForFirstFrame();
    logger.debug('chat run first frame ready', { runId });
  } catch (err) {
    logger.warn('chat run failed before first frame', {
      runId,
      agentId: body.agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    ctx.runs.delete(runId);
    throw err;
  }

  logger.info('chat stream ready', { runId, agentId: body.agentId });
  return {
    kind: 'stream',
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-persona-run-id': runId,
    },
    body: withHeartbeats(driver.subscribe(-1), ctx.heartbeatIntervalMs),
  };
};
