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
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

mcpSchema.index({ ownerId: 1, name: 1 }, { unique: true });

const Mcp = mongoose.model('Mcp', mcpSchema);

export default Mcp;
