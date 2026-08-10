import type { RouteHandler } from '../routing.js';
import { json, noContent, requireParam } from '../routeHelpers.js';

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

export const getOwnerAuthorizeUrl: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.mcps.oauth.getOwnerAuthorizeUrl(requireParam(ctx.params, 'id'));
  return json(200, result);
};

export const getUserAuthorizeUrl: RouteHandler = async (request, ctx) => {
  const result = await ctx.client.mcps.oauth.getUserAuthorizeUrl(
    requireParam(ctx.params, 'id'),
    request.query.returnTo
  );
  return json(200, result);
};

export const getUserConnectionStatus: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.mcps.oauth.getUserConnectionStatus(
    requireParam(ctx.params, 'id')
  );
  return json(200, result);
};

export const disconnectUserConnection: RouteHandler = async (_request, ctx) => {
  await ctx.client.mcps.oauth.disconnectUserConnection(requireParam(ctx.params, 'id'));
  return noContent();
};

export const disconnectOwnerConnection: RouteHandler = async (_request, ctx) => {
  await ctx.client.mcps.oauth.disconnectOwnerConnection(requireParam(ctx.params, 'id'));
  return noContent();
};
