import mongoose from 'mongoose';

/**
 * RestApiToolSource — a hosted manifest URL Persona pulls REST tool
 * definitions from, mirroring `Mcp` exactly (see `mcp.model.js`): `url` +
 * `authType`/`secretRef` + `testConnection` populating a display-only
 * `tools` summary, simplified to `none`/`apiKey` auth only (no OAuth — a
 * static shared secret drawn from the Project's own Secrets tab, same
 * `secretRef` pattern `RestApiTool`'s `authType: 'bearerSecret'` uses).
 *
 * `tools` here is a **cache for the dashboard only** — exactly `Mcp.tools`'s
 * role. Agent execution never reads it: an attached source's tools are
 * fetched live from `url` on every agent run
 * (`restApiToolSource.tools.js#resolveRestApiToolSourceTools`), the same way
 * `mcp.tools.js#resolveMcpTools` never reads `Mcp.tools` either. Agents
 * attach this whole document (`agent.restApiToolSources: [ObjectId]`), not
 * individual tools — no `RestApiTool` document is ever created from this.
 */
const toolSummarySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    method: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const restApiToolSourceSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      default: 'persona',
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['PersonaUser', 'Project', 'ExternalUser'],
      default: 'PersonaUser',
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.ownerType === 'PersonaUser';
      },
      index: true,
    },
    externalOwnerId: {
      type: String,
      default: null,
      required: function () {
        return this.ownerType === 'ExternalUser';
      },
      index: true,
    },
    name: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 100,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500,
      default: '',
    },
    // The manifest endpoint hosted by the developer's own runtime/adapter
    // (`@personaai/runtime`'s `restToolsManifest` option) or any server
    // returning the same `{ tools: [...] }` shape.
    url: {
      type: String,
      required: true,
      trim: true,
    },
    authType: {
      type: String,
      enum: ['none', 'apiKey'],
      default: 'none',
    },
    // Reuses the Project's own Secrets tab — same `secretRef` pattern as
    // RestApiTool's `authType: 'bearerSecret'` (restApiTool.model.js), so an
    // admin picks/creates a secret once and reuses it across REST Tools and
    // REST Tool Sources alike, instead of pasting the same key twice.
    secretRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectSecret',
      default: null,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
    // Populated by testConnection — display-only, see the doc comment above.
    tools: {
      type: [toolSummarySchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Same partialFilterExpression rationale as mcp.model.js/restApiTool.model.js.
restApiToolSourceSchema.index(
  { ownerId: 1, name: 1 },
  { unique: true, partialFilterExpression: { ownerId: { $exists: true } } }
);

const RestApiToolSource = mongoose.model('RestApiToolSource', restApiToolSourceSchema);

export default RestApiToolSource;
