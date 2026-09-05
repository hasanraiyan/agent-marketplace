import type { RouteHandler } from '../routing.js';
import { json } from '../routeHelpers.js';
import { RuntimeHttpError } from '../errors.js';

/**
 * Serves the configured `restToolsManifest.tools` list as
 * `{ tools: [...] }` — the shape a Persona REST Tool Source's Test
 * Connection expects. Never touches `PersonaClient`; this is pure host-side
 * data. `requiresAuth: false` at the route-table level (see `runtime.ts`) —
 * this is Persona-to-server traffic authenticated by its own bearer token
 * below, not an end-user request needing `resolveUser`.
 */
export const restToolsManifestRoute: RouteHandler = async (request, ctx) => {
  const manifest = ctx.restToolsManifest;
  if (!manifest) {
    throw new RuntimeHttpError(404, 'NOT_FOUND', 'No REST tools manifest is configured.');
  }

  if (manifest.authToken) {
    const header = request.headers.authorization;
    const expected = `Bearer ${manifest.authToken}`;
    if (header !== expected) {
      throw new RuntimeHttpError(401, 'UNAUTHORIZED', 'Invalid or missing manifest bearer token.');
    }
  }

  return json(200, { tools: manifest.tools });
};
