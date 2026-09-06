import mongoose from 'mongoose';

/**
 * RcpSource — a hosted RCP (REST Connector Protocol, npm `rcp-sdk`) manifest
 * URL Persona pulls tool definitions from. Mirrors `RestApiToolSource`
 * exactly (see `restApiToolSource.model.js`), independent of it — REST Tool
 * Sources are untouched by this feature.
 *
 * `authType` is `none`/`header` only (not `oauth2`) — matches what
 * `rcp-sdk`'s client actually implements today.
 *
 * `tools` here is a **display cache for the dashboard only**, written by
 * Test Connection. Agent execution never reads it: an attached source's
 * tools are discovered live via `rcp-sdk`'s `createRcpClient().discover()`
 * on every agent run (`rcpSources/rcpSource.tools.js`). Agents attach this
 * whole document (`agent.rcpSources: [ObjectId]`), not individual tools.
 */
const toolParamSummarySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, default: 'string' },
    description: { type: String, default: '' },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const toolSummarySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    method: { type: String, required: true },
    url: { type: String, required: true },
    // Full param list (never resolver-filtered — `_buildClientFor` in
    // rcpSource.service.js registers no resolvers, so `discover()`'s
    // `exposedParams` here is always the complete list) — the dashboard
    // needs every param name to build `paramContextMap`, not just the ones
    // currently unmapped. See TURN_CONTEXT_RCP_RESOLVERS_PLAN.md.
    params: { type: [toolParamSummarySchema], default: [] },
  },
  { _id: false }
);

// TURN_CONTEXT_RCP_RESOLVERS_PLAN.md — maps one of this source's tool param
// names to a key an agent's caller sends in a message's per-turn `context`
// object. Static config only (param/contextKey names, never a value): once
// mapped, that param is hidden from the model on every turn, for every
// agent this source is attached to (shared, not per-attachment — see the
// model's own doc comment below for why).
const paramContextMapEntrySchema = new mongoose.Schema(
  {
    param: { type: String, required: true },
    contextKey: { type: String, required: true },
  },
  { _id: false }
);

const rcpSourceSchema = new mongoose.Schema(
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
    // The RCP manifest URL — `GET url` must return a conformant
    // `{ rcpVersion, auth, tools[] }` document.
    url: {
      type: String,
      required: true,
      trim: true,
    },
    authType: {
      type: String,
      enum: ['none', 'header'],
      default: 'none',
    },
    // Reuses the Project's own Secrets tab, same pattern as
    // RestApiToolSource's `secretRef` — one secret picked once, reused
    // across every feature that needs one.
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
    // Shared by every agent this source is attached to (a param mapping is
    // a property of the manifest connection, not of any one agent's
    // conversation) — see TURN_CONTEXT_RCP_RESOLVERS_PLAN.md. Edited on this
    // source's own Create/Edit page; an agent's edit page only displays it
    // read-only, so an admin attaching the source can see what context keys
    // it expects the caller to send.
    paramContextMap: {
      type: [paramContextMapEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Same partialFilterExpression rationale as restApiToolSource.model.js.
rcpSourceSchema.index(
  { ownerId: 1, name: 1 },
  { unique: true, partialFilterExpression: { ownerId: { $exists: true } } }
);

const RcpSource = mongoose.model('RcpSource', rcpSourceSchema);

export default RcpSource;
