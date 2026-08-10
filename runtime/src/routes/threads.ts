import type { UpdateThreadInput } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';

function json(status: number, value: unknown) {
  return {
    kind: 'buffered' as const,
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  };
}

function requireId(params: Record<string, string>): string {
  const id = params.id;
  if (!id) throw new RuntimeHttpError(400, 'INVALID_REQUEST', '"id" path parameter is required.');
  return id;
}

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export const listThreads: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.threads.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
  });
  return json(200, items);
};

export const createThread: RouteHandler = async (request, ctx) => {
  const body = request.body as Record<string, unknown> | undefined;
  if (typeof body?.agentId !== 'string' || body.agentId.length === 0) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"agentId" is required and must be a string.'
    );
  }
  const thread = await ctx.client.threads.create({ agentId: body.agentId });

  await ctx.hooks?.onThreadCreate?.({
    userId: request.userId as string,
    agentId: body.agentId,
    threadId: thread._id,
  });

  return json(201, thread);
};

export const getThread: RouteHandler = async (_request, ctx) => {
  const thread = await ctx.client.threads.get(requireId(ctx.params));
  return json(200, thread);
};

export const updateThread: RouteHandler = async (request, ctx) => {
  const body = (request.body as UpdateThreadInput | undefined) ?? {};
  const thread = await ctx.client.threads.update(requireId(ctx.params), body);
  return json(200, thread);
};

export const deleteThread: RouteHandler = async (_request, ctx) => {
  await ctx.client.threads.delete(requireId(ctx.params));
  return { kind: 'buffered', status: 204, headers: {}, body: '' };
};
