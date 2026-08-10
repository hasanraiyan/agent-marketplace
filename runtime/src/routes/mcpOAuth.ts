import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';

/**
 * MCP OAuth — deliberately narrow. The SDK's `McpOAuthResource` has no
 * "handle the OAuth provider's callback" method at all: Persona's own
 * backend receives that redirect directly (the OAuth dance is explicitly
 * something Persona owns, per the vision doc), so there is no callback
 * route for this runtime to expose. What a host actually needs is: get a
 * URL to redirect a browser to, check status, and disconnect.
 *
 * Owner-mode routes affect the shared MCP config for the whole Project —
 * this runtime has no concept of roles/permissions beyond "is there a
 * resolved user" (RBAC is explicitly the host's own business decision, not
 * Persona's); a production host should gate these behind its own
 * authorization check before calling them, e.g. inside `resolveUser` or a
 * wrapping middleware in front of the mount point.
 */

function json(status: number, value: unknown) {
  return {
    kind: 'buffered' as const,
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  };
}

function requireMcpId(params: Record<string, string>): string {
  const id = params.id;
  if (!id) throw new RuntimeHttpError(400, 'INVALID_REQUEST', '"id" path parameter is required.');
  return id;
}

export const getOwnerAuthorizeUrl: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.mcps.oauth.getOwnerAuthorizeUrl(requireMcpId(ctx.params));
  return json(200, result);
};

export const getUserAuthorizeUrl: RouteHandler = async (request, ctx) => {
  const result = await ctx.client.mcps.oauth.getUserAuthorizeUrl(
    requireMcpId(ctx.params),
    request.query.returnTo
  );
  return json(200, result);
};

export const getUserConnectionStatus: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.mcps.oauth.getUserConnectionStatus(requireMcpId(ctx.params));
  return json(200, result);
};

export const disconnectUserConnection: RouteHandler = async (_request, ctx) => {
  await ctx.client.mcps.oauth.disconnectUserConnection(requireMcpId(ctx.params));
  return { kind: 'buffered', status: 204, headers: {}, body: '' };
};

export const disconnectOwnerConnection: RouteHandler = async (_request, ctx) => {
  await ctx.client.mcps.oauth.disconnectOwnerConnection(requireMcpId(ctx.params));
  return { kind: 'buffered', status: 204, headers: {}, body: '' };
};
