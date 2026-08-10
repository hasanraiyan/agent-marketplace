import type { CreateProviderInput, UpdateProviderInput } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import {
  json,
  noContent,
  requireParam,
  requireBodyObject,
  requireStringField,
} from '../routeHelpers.js';

// Everything here requires capabilities.providers — these routes touch LLM
// API keys. Off by default; see CreateRuntimeOptions.capabilities' doc
// comment before ever enabling this.

export const listProviders: RouteHandler = async (_request, ctx) => {
  const items = await ctx.client.providers.list();
  return json(200, items);
};

export const createProvider: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input: CreateProviderInput = {
    label: requireStringField(body, 'label'),
    baseURL: requireStringField(body, 'baseURL'),
    apiKey: requireStringField(body, 'apiKey'),
    defaultModel: requireStringField(body, 'defaultModel'),
    isDefault: typeof body.isDefault === 'boolean' ? body.isDefault : undefined,
  };
  const provider = await ctx.client.providers.create(input);
  return json(201, provider);
};

export const getProvider: RouteHandler = async (_request, ctx) => {
  const provider = await ctx.client.providers.get(requireParam(ctx.params, 'id'));
  return json(200, provider);
};

export const updateProvider: RouteHandler = async (request, ctx) => {
  const body = (request.body as UpdateProviderInput | undefined) ?? {};
  const provider = await ctx.client.providers.update(requireParam(ctx.params, 'id'), body);
  return json(200, provider);
};

export const deleteProvider: RouteHandler = async (_request, ctx) => {
  await ctx.client.providers.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const bulkDeleteProviders: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  const result = await ctx.client.providers.bulkDelete(ids);
  return json(200, result);
};

export const testProviderConnection: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.providers.testConnection(requireParam(ctx.params, 'id'));
  return json(200, result);
};

export const getProviderModels: RouteHandler = async (_request, ctx) => {
  const models = await ctx.client.providers.getModels(requireParam(ctx.params, 'id'));
  return json(200, models);
};

export const getProviderUsage: RouteHandler = async (_request, ctx) => {
  const usage = await ctx.client.providers.getUsage(requireParam(ctx.params, 'id'));
  return json(200, usage);
};
