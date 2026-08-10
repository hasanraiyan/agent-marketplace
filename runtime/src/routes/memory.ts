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

function requireScope(query: Record<string, string | undefined>): {
  scope: 'user' | 'agent' | undefined;
  agentId: string | undefined;
} {
  const scope = query.scope === 'agent' ? 'agent' : query.scope === 'user' ? 'user' : undefined;
  if (scope === 'agent' && !query.agentId) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"agentId" is required when scope is "agent".'
    );
  }
  return { scope, agentId: query.agentId };
}

export const listMemory: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.memory.list();
  return json(200, result);
};

export const getMemoryFile: RouteHandler = async (request, ctx) => {
  const path = request.query.path;
  if (!path)
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', '"path" query parameter is required.');
  const { scope, agentId } = requireScope(request.query);

  const file = await ctx.client.memory.getFile({ path, scope, agentId });
  return json(200, file);
};

export const writeMemoryFile: RouteHandler = async (request, ctx) => {
  const body = request.body as Record<string, unknown> | undefined;
  if (typeof body?.path !== 'string' || body.path.length === 0) {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', '"path" is required and must be a string.');
  }
  if (typeof body.content !== 'string') {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"content" is required and must be a string.'
    );
  }
  const scope = body.scope === 'agent' ? 'agent' : body.scope === 'user' ? 'user' : undefined;
  const agentId = typeof body.agentId === 'string' ? body.agentId : undefined;
  if (scope === 'agent' && !agentId) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"agentId" is required when scope is "agent".'
    );
  }

  const file = await ctx.client.memory.writeFile({
    path: body.path,
    content: body.content,
    scope,
    agentId,
  });

  await ctx.hooks?.onMemoryWrite?.({ userId: request.userId as string, agentId, path: body.path });

  return json(200, file);
};

export const deleteMemoryFile: RouteHandler = async (request, ctx) => {
  const path = request.query.path;
  if (!path)
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', '"path" query parameter is required.');
  const { scope, agentId } = requireScope(request.query);

  await ctx.client.memory.deleteFile({ path, scope, agentId });
  return { kind: 'buffered', status: 204, headers: {}, body: '' };
};
