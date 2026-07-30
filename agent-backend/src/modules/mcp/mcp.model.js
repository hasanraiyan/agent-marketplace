import mongoose from 'mongoose';

const ownerTokenSchema = new mongoose.Schema(
  {
    accessTokenEncrypted: { type: String, default: null },
    refreshTokenEncrypted: { type: String, default: null },
    expiresAt: { type: Date, default: null },
  },
  { _id: false }
);

const oauthSchema = new mongoose.Schema(
  {
    clientId: { type: String, default: null },
    clientSecretEncrypted: { type: String, default: null },
    authorizationEndpoint: { type: String, default: null },
    tokenEndpoint: { type: String, default: null },
    scopes: { type: [String], default: [] },
    dynamicallyRegistered: { type: Boolean, default: false },
    tokenEndpointAuthMethod: {
      type: String,
      enum: ['client_secret_basic', 'client_secret_post', 'none'],
      default: 'client_secret_basic',
    },
    ownerToken: { type: ownerTokenSchema, default: () => ({}) },
  },
  { _id: false }
);

const mcpSchema = new mongoose.Schema(
  {
    // Developer Platform (AD-03, AD-04 §18: MCP definitions support
    // PersonaUser/Project/ExternalUser): same additive pattern as Agent
    // (agent.model.js) — see that file for the full rationale.
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
    // Developer Platform (AD-04, blueprint Phase 9, PR-33): same
    // conditional-required generalization as Agent (PR-24) / Skill
    // (PR-27) / KnowledgeBase (PR-30) — only required for
    // `ownerType: 'PersonaUser'`.
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.ownerType === 'PersonaUser';
      },
      index: true,
    },
    // Developer Platform (AD-02 §11.1, blueprint Phase 9, PR-33): mirrors
    // Agent's/Skill's/KnowledgeBase's own `externalOwnerId` exactly.
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
    transport: {
      type: String,
      enum: ['http', 'sse'],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    authType: {
      type: String,
      enum: ['none', 'oauth', 'apiKey'],
      default: 'none',
    },
    authMode: {
      type: String,
      enum: ['owner', 'user'],
      default: 'owner',
    },
    oauth: { type: oauthSchema, default: () => ({}) },
    // Static bearer token for `authType: 'apiKey'` servers (e.g. Excalidraw's
    // `Authorization: Bearer <API_KEY>`) - no OAuth discovery/flow, just a
    // fixed secret sent on every request. Always owner-shared (authMode
    // doesn't apply): there's only one key, not a per-user token exchange.
    apiKeyEncrypted: { type: String, default: null },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    tools: [
      {
        name: String,
        description: String,
      },
    ],
    resources: [
      {
        uri: String,
        name: String,
        description: String,
        mimeType: String,
      },
    ],
    resourceTemplates: [
      {
        uriTemplate: String,
        name: String,
        description: String,
        mimeType: String,
        toolName: String,
      },
    ],
    lastTestedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Developer Platform (blueprint Phase 9, PR-33): scoped with a
// partialFilterExpression — see skill.model.js's identical PR-27 fix for
// the full rationale (a non-partial unique index would otherwise treat
// every Project-/ExternalUser-owned Mcp's missing `ownerId` as `null`,
// colliding across unrelated documents that merely share a `name`).
mcpSchema.index(
  { ownerId: 1, name: 1 },
  { unique: true, partialFilterExpression: { ownerId: { $exists: true } } }
);

const Mcp = mongoose.model('Mcp', mcpSchema);

export default Mcp;
