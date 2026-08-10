import type { CreateMcpInput, DiscoverMcpsParams, UpdateMcpInput } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import {
  json,
  noContent,
  requireParam,
  requireBodyObject,
  requireStringField,
  requireQueryParam,
  toInt,
} from '../routeHelpers.js';

// Everything here requires capabilities.mcps — registering/managing MCP
// server connections is Project-admin work. The always-on `/mcps/:id/oauth/*`
// routes (routes/mcpOAuth.ts) are separate and unaffected by this flag.

export const listMcps: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.mcps.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    search: request.query.search,
    scope: request.query.scope === 'mine' ? 'mine' : undefined,
  } satisfies DiscoverMcpsParams);
  return json(200, items);
};

export const createMcp: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input: CreateMcpInput = {
    name: requireStringField(body, 'name'),
    transport: requireStringField(body, 'transport') as CreateMcpInput['transport'],
    url: requireStringField(body, 'url'),
    description: typeof body.description === 'string' ? body.description : undefined,
    authType: body.authType as CreateMcpInput['authType'],
    authMode: body.authMode as CreateMcpInput['authMode'],
    oauth: body.oauth as CreateMcpInput['oauth'],
    apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
  };
  const mcp = await ctx.client.mcps.create(input);
  return json(201, mcp);
};

export const getMcp: RouteHandler = async (_request, ctx) => {
  const mcp = await ctx.client.mcps.get(requireParam(ctx.params, 'id'));
  return json(200, mcp);
};

export const updateMcp: RouteHandler = async (request, ctx) => {
  const body = (request.body as UpdateMcpInput | undefined) ?? {};
  const mcp = await ctx.client.mcps.update(requireParam(ctx.params, 'id'), body);
  return json(200, mcp);
};

export const deleteMcp: RouteHandler = async (_request, ctx) => {
  await ctx.client.mcps.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const bulkDeleteMcps: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  const result = await ctx.client.mcps.bulkDelete(ids);
  return json(200, result);
};

export const getMcpUsage: RouteHandler = async (_request, ctx) => {
  const usage = await ctx.client.mcps.getUsage(requireParam(ctx.params, 'id'));
  return json(200, usage);
};

export const testMcpConnection: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.mcps.testConnection(requireParam(ctx.params, 'id'));
  return json(200, result);
};

export const readMcpResource: RouteHandler = async (request, ctx) => {
  const uri = requireQueryParam(request.query, 'uri');
  const result = await ctx.client.mcps.readResource(requireParam(ctx.params, 'id'), uri);
  return json(200, result);
};

export const callMcpTool: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const name = requireStringField(body, 'name');
  const args = (body.arguments as Record<string, unknown> | undefined) ?? undefined;
  const result = await ctx.client.mcps.callTool(requireParam(ctx.params, 'id'), name, args);
  return json(200, result);
};
