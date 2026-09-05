import type { RouteHandler } from '../routing.js';
import { json, requireBodyObject, requireStringField } from '../routeHelpers.js';

/**
 * Mints a single-use voice session ticket via `@personaai/sdk`'s
 * `client.voice.createSession(agentId)`. Always on (like `chat`/`threads`)
 * — voice is an end-user chat-session action, not Project-level admin
 * configuration, so it isn't gated behind a `RuntimeCapabilities` flag.
 *
 * The host's own frontend takes the returned `wsUrl` (ticket already
 * embedded) and opens `new WebSocket(wsUrl)` directly — this runtime never
 * proxies the WebSocket itself, only the one-time ticket mint, so the
 * Project credential never needs to sit in front of an open connection.
 */
export const createVoiceSession: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const agentId = requireStringField(body, 'agentId');
  const threadId =
    typeof body.threadId === 'string' && body.threadId ? body.threadId : undefined;
  const ticket = await ctx.client.voice.createSession(agentId, threadId ? { threadId } : {});

  await ctx.hooks?.onVoiceSessionCreate?.({
    userId: request.userId as string,
    agentId,
    threadId,
  });

  return json(201, ticket);
};
