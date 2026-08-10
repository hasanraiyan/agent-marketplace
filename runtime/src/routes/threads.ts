import type { UpdateThreadInput } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import {
  json,
  noContent,
  requireParam,
  requireBodyObject,
  requireStringField,
  toInt,
} from '../routeHelpers.js';

export const listThreads: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.threads.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
  });
  return json(200, items);
};

export const createThread: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const agentId = requireStringField(body, 'agentId');
  const thread = await ctx.client.threads.create({ agentId });

  await ctx.hooks?.onThreadCreate?.({
    userId: request.userId as string,
    agentId,
    threadId: thread._id,
  });

  return json(201, thread);
};

export const getThread: RouteHandler = async (_request, ctx) => {
  const thread = await ctx.client.threads.get(requireParam(ctx.params, 'id'));
  return json(200, thread);
};

export const updateThread: RouteHandler = async (request, ctx) => {
  const body = (request.body as UpdateThreadInput | undefined) ?? {};
  const thread = await ctx.client.threads.update(requireParam(ctx.params, 'id'), body);
  return json(200, thread);
};

export const deleteThread: RouteHandler = async (_request, ctx) => {
  await ctx.client.threads.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const bulkDeleteThreads: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  const result = await ctx.client.threads.bulkDelete(ids);
  return json(200, result);
};

/** The same message history + graph state `chat.stream()` would resume from — load a past conversation on page reopen. */
export const getThreadMessages: RouteHandler = async (_request, ctx) => {
  const messages = await ctx.client.threads.getMessages(requireParam(ctx.params, 'id'));
  return json(200, messages);
};
