import type { RouteHandler } from '../routing.js';
import { json } from '../routeHelpers.js';
import { RuntimeHttpError } from '../errors.js';

/**
 * Serves the configured `rcpManifest.tools` list as a conformant RCP
 * manifest — `{ rcpVersion, auth, tools }` — the shape any RCP client's
 * `discover()` expects. Never touches `PersonaClient`; this is pure
 * host-side data, unrelated to `restToolsManifestRoute`.
 * `requiresAuth: false` at the route-table level (see `runtime.ts`) — this
 * is client-to-server traffic authenticated by its own bearer token below,
 * not an end-user request needing `resolveUser`.
 */
export const rcpManifestRoute: RouteHandler = async (request, ctx) => {
  const manifest = ctx.rcpManifest;
  if (!manifest) {
    throw new RuntimeHttpError(404, 'NOT_FOUND', 'No RCP manifest is configured.');
  }

  if (manifest.authToken) {
    const header = request.headers.authorization;
    const expected = `Bearer ${manifest.authToken}`;
    if (header !== expected) {
      throw new RuntimeHttpError(401, 'UNAUTHORIZED', 'Invalid or missing manifest bearer token.');
    }
  }

  return json(200, {
    rcpVersion: '0.1',
    auth: manifest.authToken
      ? { type: 'header', header: 'Authorization', scheme: 'Bearer' }
      : { type: 'none' },
    tools: manifest.tools,
  });
};
