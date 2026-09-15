import type { CreateRcpSourceInput, UpdateRcpSourceInput } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import {
  json,
  noContent,
  requireParam,
  requireBodyObject,
  requireStringField,
  toInt,
} from '../routeHelpers.js';

// Everything here requires capabilities.rcpSources — RCP source management
// is Project-level tool-source configuration, not an end-user chat operation.

export const listRcpSources: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.rcpSources.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    search: request.query.search,
  });
  return json(200, items);
};

export const createRcpSource: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input: CreateRcpSourceInput = {
    name: requireStringField(body, 'name'),
    url: requireStringField(body, 'url'),
    description: typeof body.description === 'string' ? body.description : undefined,
    authType: body.authType as CreateRcpSourceInput['authType'],
    secretRef: typeof body.secretRef === 'string' ? body.secretRef : undefined,
    isEnabled: typeof body.isEnabled === 'boolean' ? body.isEnabled : undefined,
    paramContextMap: Array.isArray(body.paramContextMap)
      ? (body.paramContextMap as CreateRcpSourceInput['paramContextMap'])
      : undefined,
  };
  const source = await ctx.client.rcpSources.create(input);
  return json(201, source);
};

export const getRcpSource: RouteHandler = async (_request, ctx) => {
  const source = await ctx.client.rcpSources.get(requireParam(ctx.params, 'id'));
  return json(200, source);
};

export const updateRcpSource: RouteHandler = async (request, ctx) => {
  const body = (request.body as UpdateRcpSourceInput | undefined) ?? {};
  const source = await ctx.client.rcpSources.update(requireParam(ctx.params, 'id'), body);
  return json(200, source);
};

export const deleteRcpSource: RouteHandler = async (_request, ctx) => {
  await ctx.client.rcpSources.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const bulkDeleteRcpSources: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  const result = await ctx.client.rcpSources.bulkDelete(ids);
  return json(200, result);
};

export const getRcpSourceUsage: RouteHandler = async (_request, ctx) => {
  const usage = await ctx.client.rcpSources.getUsage(requireParam(ctx.params, 'id'));
  return json(200, usage);
};

export const testRcpSourceConnection: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.rcpSources.testConnection(requireParam(ctx.params, 'id'));
  return json(200, result);
};
