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
const toolSummarySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    method: { type: String, required: true },
    url: { type: String, required: true },
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
