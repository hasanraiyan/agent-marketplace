import restApiToolService from '../restApiTools/restApiTool.service.js';
import {
  createRestApiToolSchema,
  updateRestApiToolSchema,
} from '../restApiTools/restApiTool.validator.js';
import { createManageResourceTool } from './manageResourceFactory.js';

/**
 * manage_rest_api_tool — CRUD+patch over the no-code REST API Tool Builder
 * (a single hand-defined REST call: method/url/params/body/response
 * mapping). Project/Developer architect only — RestApiTool has no
 * Persona-facing route (only `developer/developerRestTool.routes.js`).
 *
 * Independent of RestApiToolSources (whole imported OpenAPI-style
 * collections, superseded by RcpSource — see manageRcpSource.tools.js) and
 * of RcpSource itself: this tool is for one hand-built call, not a
 * collection pulled from a manifest.
 */
export const manageRestApiToolTool = (identity) => {
  const safe = (tool) => (tool ? restApiToolService.toSafeJson(tool) : tool);

  return createManageResourceTool({
    name: 'manage_rest_api_tool',
    description:
      "CRUD for this Project's no-code REST API tools (one hand-defined HTTP call: method, url, query/header params, body, response mapping). Attach an existing tool to an agent by id via manage_agent's `restApiTools` field or a `patch` with op 'add'.",
    actions: ['create', 'read', 'update', 'patch', 'delete'],
    patchableFields: {
      name: 'scalar',
      description: 'scalar',
      url: 'scalar',
      method: 'scalar',
      isEnabled: 'scalar',
    },
    list: async (filters) => {
      const tools = await restApiToolService.discoverRestApiTools(identity.context, filters, {
        page: 1,
        limit: 100,
      });
      return tools.map(safe);
    },
    get: async (id) =>
      safe(await restApiToolService.getRestApiToolById(id, identity.userId, identity.context)),
    create: async (data) => {
      const parsed = createRestApiToolSchema.parse(data);
      return safe(
        await restApiToolService.createRestApiTool(identity.userId, parsed, identity.context)
      );
    },
    update: async (id, data) => {
      const parsed = updateRestApiToolSchema.parse(data);
      return safe(
        await restApiToolService.updateRestApiTool(id, identity.userId, parsed, identity.context)
      );
    },
    remove: async (id) =>
      restApiToolService.deleteRestApiTool(id, identity.userId, identity.context),
  });
};
