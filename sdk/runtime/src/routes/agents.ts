import type { AgentCategory, CreateAgentInput, UpdateAgentInput } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import {
  json,
  noContent,
  requireParam,
  requireBodyObject,
  requireStringField,
  toInt,
} from '../routeHelpers.js';

/** Always on — read-only discovery, e.g. "let the user pick an agent to chat with". */
export const listAgents: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.agents.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    search: request.query.search,
    category: request.query.category as AgentCategory | undefined,
    scope: request.query.scope === 'mine' ? 'mine' : undefined,
  });
  return json(200, items);
};

/**
 * Always on, read-only, end-user-scoped — same tier as the MCP OAuth
 * routes below, not the agentsWrite-gated Agent CRUD routes further down.
 * A chat-only consumer needs this to show "connect your account" for a
 * tool it can't otherwise reach: mcp.tools.js silently drops a user-mode
 * MCP's tools from an Agent's toolset when the calling user hasn't
 * connected yet, with no other signal anywhere.
 */
export const getAgentMcpConnections: RouteHandler = async (request, ctx) => {
  const connections = await ctx.client.agents.getMcpConnections(
    requireParam(ctx.params, 'id'),
    request.query.returnTo
  );
  return json(200, connections);
};

// Everything below requires capabilities.agentsWrite — provisioning agents
// is Project-admin work, not something an end-user chat session does.

export const createAgent: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input: CreateAgentInput = {
    name: requireStringField(body, 'name'),
    systemPrompt: requireStringField(body, 'systemPrompt'),
    providerId: requireStringField(body, 'providerId'),
    description: typeof body.description === 'string' ? body.description : undefined,
    avatar: typeof body.avatar === 'string' ? body.avatar : undefined,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    tagline: typeof body.tagline === 'string' ? body.tagline : undefined,
    bio: typeof body.bio === 'string' ? body.bio : undefined,
    socialLinks: (body.socialLinks as CreateAgentInput['socialLinks']) ?? undefined,
    modelName: typeof body.modelName === 'string' ? body.modelName : undefined,
    webSearchEnabled:
      typeof body.webSearchEnabled === 'boolean' ? body.webSearchEnabled : undefined,
    visibility: body.visibility as CreateAgentInput['visibility'],
    category: body.category as AgentCategory | undefined,
    skills: Array.isArray(body.skills) ? (body.skills as string[]) : undefined,
    mcps: Array.isArray(body.mcps) ? (body.mcps as string[]) : undefined,
    knowledgeBases: Array.isArray(body.knowledgeBases)
      ? (body.knowledgeBases as string[])
      : undefined,
    storeMounts: Array.isArray(body.storeMounts) ? (body.storeMounts as string[]) : undefined,
    interruptOn: (body.interruptOn as Record<string, boolean>) ?? undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  };
  const agent = await ctx.client.agents.create(input);
  return json(201, agent);
};

export const getAgent: RouteHandler = async (_request, ctx) => {
  const agent = await ctx.client.agents.get(requireParam(ctx.params, 'id'));
  return json(200, agent);
};

export const updateAgent: RouteHandler = async (request, ctx) => {
  const body = (request.body as UpdateAgentInput | undefined) ?? {};
  const agent = await ctx.client.agents.update(requireParam(ctx.params, 'id'), body);
  return json(200, agent);
};

export const deleteAgent: RouteHandler = async (_request, ctx) => {
  await ctx.client.agents.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const bulkDeleteAgents: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  const result = await ctx.client.agents.bulkDelete(ids);
  return json(200, result);
};
