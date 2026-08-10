import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import {
  json,
  noContent,
  requireQueryParam,
  requireBodyObject,
  requireStringField,
} from '../routeHelpers.js';

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
  const path = requireQueryParam(request.query, 'path');
  const { scope, agentId } = requireScope(request.query);

  const file = await ctx.client.memory.getFile({ path, scope, agentId });
  return json(200, file);
};

export const writeMemoryFile: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const path = requireStringField(body, 'path');
  const content = requireStringField(body, 'content');
  const scope = body.scope === 'agent' ? 'agent' : body.scope === 'user' ? 'user' : undefined;
  const agentId = typeof body.agentId === 'string' ? body.agentId : undefined;
  if (scope === 'agent' && !agentId) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"agentId" is required when scope is "agent".'
    );
  }

  const file = await ctx.client.memory.writeFile({ path, content, scope, agentId });

  await ctx.hooks?.onMemoryWrite?.({ userId: request.userId as string, agentId, path });

  return json(200, file);
};

export const deleteMemoryFile: RouteHandler = async (request, ctx) => {
  const path = requireQueryParam(request.query, 'path');
  const { scope, agentId } = requireScope(request.query);

  await ctx.client.memory.deleteFile({ path, scope, agentId });
  return noContent();
};
