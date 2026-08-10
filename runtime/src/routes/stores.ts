import type { CreateStoreInput, UpdateStoreInput } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import {
  json,
  noContent,
  requireParam,
  requireQueryParam,
  requireBodyObject,
  requireStringField,
  toInt,
} from '../routeHelpers.js';

// Everything here requires capabilities.stores — vector store provisioning
// is Project-level configuration, not an end-user chat operation.

export const listStores: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.stores.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    search: request.query.search,
  });
  return json(200, items);
};

export const createStore: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input: CreateStoreInput = {
    name: requireStringField(body, 'name'),
    description: typeof body.description === 'string' ? body.description : undefined,
    scope: requireStringField(body, 'scope') as CreateStoreInput['scope'],
    accessMode: body.accessMode as CreateStoreInput['accessMode'],
  };
  const store = await ctx.client.stores.create(input);
  return json(201, store);
};

export const getStore: RouteHandler = async (_request, ctx) => {
  const store = await ctx.client.stores.get(requireParam(ctx.params, 'id'));
  return json(200, store);
};

export const updateStore: RouteHandler = async (request, ctx) => {
  const body = (request.body as UpdateStoreInput | undefined) ?? {};
  const store = await ctx.client.stores.update(requireParam(ctx.params, 'id'), body);
  return json(200, store);
};

export const deleteStore: RouteHandler = async (_request, ctx) => {
  await ctx.client.stores.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const listStoreFiles: RouteHandler = async (_request, ctx) => {
  const files = await ctx.client.stores.listFiles(requireParam(ctx.params, 'id'));
  return json(200, files);
};

export const getStoreFile: RouteHandler = async (request, ctx) => {
  const path = requireQueryParam(request.query, 'path');
  const file = await ctx.client.stores.getFile(requireParam(ctx.params, 'id'), { path });
  return json(200, file);
};

export const writeStoreFile: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input = {
    path: requireStringField(body, 'path'),
    content: requireStringField(body, 'content'),
  };
  const file = await ctx.client.stores.writeFile(requireParam(ctx.params, 'id'), input);
  return json(200, file);
};

export const deleteStoreFile: RouteHandler = async (request, ctx) => {
  const path = requireQueryParam(request.query, 'path');
  await ctx.client.stores.deleteFile(requireParam(ctx.params, 'id'), { path });
  return noContent();
};
