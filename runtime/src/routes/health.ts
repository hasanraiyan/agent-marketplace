import type { RouteHandler } from '../routing.js';
import { errorToResponse } from '../errors.js';
import { RUNTIME_VERSION } from '../version.js';

export const capabilities = {
  chat: true,
  threads: true,
  agents: true,
  files: true,
  memory: true,
  mcpOAuth: true,
};

/**
 * Liveness/capability probe — deliberately does not require `resolveUser`
 * (this route's `requiresAuth: false`, so `request.userId` stays `null` and
 * `ctx.client` is naturally a bare, Project-scoped client). It's for
 * monitoring/status pages, not a user-scoped call; a host that wants it
 * gated behind auth can do so in its own router before mounting.
 */
export const healthRoute: RouteHandler = async (_request, ctx) => {
  try {
    await ctx.client.whoami();
  } catch (err) {
    const failed = errorToResponse(err, ctx.mode);
    return { ...failed, status: 503 };
  }

  return {
    kind: 'buffered',
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'ok', version: RUNTIME_VERSION, capabilities }),
  };
};
