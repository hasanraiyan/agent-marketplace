import type { CreateSkillInput, UpdateSkillInput } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import {
  json,
  noContent,
  requireParam,
  requireBodyObject,
  requireStringField,
  toInt,
} from '../routeHelpers.js';

// Everything here requires capabilities.skills — skill authoring is
// Project-level content management, not an end-user chat operation.

export const listSkills: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.skills.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    search: request.query.search,
    scope: request.query.scope === 'mine' ? 'mine' : undefined,
  });
  return json(200, items);
};

export const createSkill: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input: CreateSkillInput = {
    name: requireStringField(body, 'name'),
    description: requireStringField(body, 'description'),
    instructions: requireStringField(body, 'instructions'),
    isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : undefined,
    files: Array.isArray(body.files) ? (body.files as CreateSkillInput['files']) : undefined,
  };
  const skill = await ctx.client.skills.create(input);
  return json(201, skill);
};

export const getSkill: RouteHandler = async (_request, ctx) => {
  const skill = await ctx.client.skills.get(requireParam(ctx.params, 'id'));
  return json(200, skill);
};

export const updateSkill: RouteHandler = async (request, ctx) => {
  const body = (request.body as UpdateSkillInput | undefined) ?? {};
  const skill = await ctx.client.skills.update(requireParam(ctx.params, 'id'), body);
  return json(200, skill);
};

export const deleteSkill: RouteHandler = async (_request, ctx) => {
  await ctx.client.skills.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const bulkDeleteSkills: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  const result = await ctx.client.skills.bulkDelete(ids);
  return json(200, result);
};

export const getSkillUsage: RouteHandler = async (_request, ctx) => {
  const usage = await ctx.client.skills.getUsage(requireParam(ctx.params, 'id'));
  return json(200, usage);
};
