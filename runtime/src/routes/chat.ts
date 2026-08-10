import type { ChatMessageInput, ChatResume } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import { RunDriver } from '../runDriver.js';
import { withHeartbeats } from '../heartbeat.js';
import type { RunContext } from '../types/hooks.js';

interface ChatBody {
  agentId: string;
  messages: ChatMessageInput[];
  threadId?: string;
  resume?: ChatResume;
  contextOverride?: string;
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
  const body = parseChatBody(request.body);
  // `requiresAuth: true` guarantees request.userId is resolved by the time a route handler runs.
  const userId = request.userId as string;

  const runCtx: RunContext = {
    userId,
    kind: 'chat',
    agentId: body.agentId,
    threadId: body.threadId,
    messages: body.messages,
  };

  await ctx.hooks?.beforeRun?.(runCtx);

  const stream = ctx.client.chat.stream(body.agentId, {
    messages: body.messages,
    threadId: body.threadId,
    resume: body.resume,
    contextOverride: body.contextOverride,
  });

  const runId = crypto.randomUUID();
  const driver = new RunDriver(runId, runCtx, stream, ctx.hooks, ctx.mode);
  ctx.runs.set(runId, driver);

  // Rejects only if the very first upstream call failed before producing
  // any frame at all — nothing has been buffered yet, so bubbling this up
  // (through runtime.ts's centralized error mapping) to a clean buffered
  // error response is correct; there's no partial stream to preserve.
  await driver.waitForFirstFrame();

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
