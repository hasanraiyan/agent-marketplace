import mcpService from '../mcp/mcp.service.js';
import { createMcpSchema, updateMcpSchema } from '../mcp/mcp.validator.js';
import { createManageResourceTool } from './manageResourceFactory.js';

/**
 * manage_mcp — CRUD+patch over MCP connector definitions, for both the
 * Persona architect (`identity: { userId }`) and the Project/Developer
 * architect (`identity: { context }`). Mcp is the one resource with routes
 * on both sides (mcp.routes.js for Persona, developer/developerMcp.routes.js
 * for Project) — unlike RcpSource/RestApiTool, which are Developer-Platform
 * only (see manageRcpSource.tools.js/manageRestApiTool.tools.js).
 *
 * `list` deliberately does NOT reuse `discoverMcps` for a Persona identity —
 * that method's own docs call out that it has no owner scoping and would
 * leak every Persona user's MCPs if used outside a Project-scoped context.
 * `getMyMcps(userId)` is the correct, already-scoped Persona list call.
 *
 * OAuth-auth MCPs are rejected here: connecting one requires an interactive
 * browser redirect (authorize URL + callback) that a chat tool can't drive.
 */
export const manageMcpTool = (identity) => {
  const safe = (mcp) => (mcp ? mcpService.toSafeJson(mcp) : mcp);

  const assertNotOAuth = (data) => {
    if (data?.authType === 'oauth') {
      throw new Error(
        "authType 'oauth' can't be configured from chat — it needs an interactive browser connect flow. Create this MCP from the Connectors tab instead, or use authType 'none'/'apiKey' here."
      );
    }
  };

  return createManageResourceTool({
    name: 'manage_mcp',
    description:
      "CRUD for this Project's/your MCP connectors (name, transport, url, auth). Attach an existing MCP to an agent by id via manage_agent's `mcps` field or a `patch` with op 'add'. OAuth-auth MCPs must be created from the Connectors tab, not here.",
    actions: ['create', 'read', 'update', 'patch', 'delete'],
    patchableFields: {
      name: 'scalar',
      description: 'scalar',
      url: 'scalar',
      isEnabled: 'scalar',
    },
    list: async (filters) => {
      const mcps = identity.context
        ? await mcpService.discoverMcps(identity.context, filters, { page: 1, limit: 100 })
        : await mcpService.getMyMcps(identity.userId);
      return mcps.map(safe);
    },
    get: async (id) => safe(await mcpService.getMcpById(id, identity.userId, identity.context)),
    create: async (data) => {
      assertNotOAuth(data);
      const parsed = createMcpSchema.parse(data);
      return safe(await mcpService.createMcp(identity.userId, parsed, identity.context));
    },
    update: async (id, data) => {
      assertNotOAuth(data);
      const parsed = updateMcpSchema.parse(data);
      return safe(await mcpService.updateMcp(id, identity.userId, parsed, identity.context));
    },
    remove: async (id) => mcpService.deleteMcp(id, identity.userId, identity.context),
  });
};
