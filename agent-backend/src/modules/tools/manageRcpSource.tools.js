import rcpSourceService from '../rcpSources/rcpSource.service.js';
import { createRcpSourceSchema, updateRcpSourceSchema } from '../rcpSources/rcpSource.validator.js';
import { createManageResourceTool } from './manageResourceFactory.js';

/**
 * manage_rcp_source — CRUD+patch over RCP (REST Connector Protocol)
 * manifest sources. Project/Developer architect only: RcpSource has no
 * Persona-facing route at all (no `rcpSource.routes.js`, only
 * `developer/developerRcpSource.routes.js`) — it superseded REST Tool
 * Sources (`restApiToolSources`), which the Architect deliberately does NOT
 * get a tool for.
 */
export const manageRcpSourceTool = (identity) => {
  const safe = (source) => (source ? rcpSourceService.toSafeJson(source) : source);

  return createManageResourceTool({
    name: 'manage_rcp_source',
    description:
      "CRUD for this Project's RCP sources (a hosted manifest URL of REST tools). Attach an existing source to an agent by id via manage_agent's `rcpSources` field or a `patch` with op 'add'. Tools are discovered live from the manifest at agent-run time, not stored per-tool.",
    actions: ['create', 'read', 'update', 'patch', 'delete'],
    patchableFields: {
      name: 'scalar',
      description: 'scalar',
      url: 'scalar',
      isEnabled: 'scalar',
    },
    list: async (filters) => {
      const sources = await rcpSourceService.discoverRcpSources(identity.context, filters, {
        page: 1,
        limit: 100,
      });
      return sources.map(safe);
    },
    get: async (id) =>
      safe(await rcpSourceService.getRcpSourceById(id, identity.userId, identity.context)),
    create: async (data) => {
      const parsed = createRcpSourceSchema.parse(data);
      return safe(await rcpSourceService.createRcpSource(identity.userId, parsed, identity.context));
    },
    update: async (id, data) => {
      const parsed = updateRcpSourceSchema.parse(data);
      return safe(
        await rcpSourceService.updateRcpSource(id, identity.userId, parsed, identity.context)
      );
    },
    remove: async (id) => rcpSourceService.deleteRcpSource(id, identity.userId, identity.context),
  });
};
