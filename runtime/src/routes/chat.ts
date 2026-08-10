import type { AguiEvent, ChatMessageInput, ChatResume } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import { chatEventsToSseBody } from '../sse.js';
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

export const chatRoute: RouteHandler = async (request, ctx) => {
  const body = parseChatBody(request.body);
  // `requiresAuth: true` guarantees request.userId is resolved by the time a route handler runs.
  const userId = request.userId as string;

  const runCtx: RunContext = {
    userId,
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

  let first: IteratorResult<AguiEvent>;
  try {
    first = await stream.next();
  } catch (err) {
    await ctx.hooks?.onError?.(
      { userId, phase: 'chat', agentId: body.agentId, threadId: body.threadId },
      err
    );
    throw err;
  }

  if (first.done) {
    await ctx.hooks?.afterRun?.(runCtx, {
      text: '',
      eventCount: 0,
      interrupted: false,
      erroredInBand: false,
    });
    return {
      kind: 'stream',
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
      body: (async function* () {})(),
    };
  }

  return {
    kind: 'stream',
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
    body: chatEventsToSseBody(first.value, stream, runCtx, ctx.hooks, ctx.mode),
  };
};
