import mongoose from 'mongoose';

const mcpUserConnectionSchema = new mongoose.Schema(
  {
    mcpId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mcp',
      required: true,
      index: true,
    },
    // Developer Platform (AD-05 §17, blueprint Phase 9, PR-47c): a
    // per-user MCP OAuth connection is Subject-scoped, not Owner-scoped —
    // same distinction as Thread (AD-04 §15.3). `(mcpId, userId)` becomes
    // `(domain, mcpId, subject)`. Same additive/conditionally-required
    // pattern as every other Subject/Owner split in this codebase.
    domain: {
      type: String,
      default: 'persona',
      index: true,
    },
    subjectType: {
      type: String,
      enum: ['PersonaUser', 'ExternalUser'],
      default: 'PersonaUser',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.subjectType === 'PersonaUser';
      },
      index: true,
    },
    externalUserId: {
      type: String,
      default: null,
      required: function () {
        return this.subjectType === 'ExternalUser';
      },
      index: true,
    },
    accessTokenEncrypted: {
      type: String,
      required: true,
    },
    refreshTokenEncrypted: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Two separate partial-unique indexes (mirrors Skill's PR-27 /
// Mcp's PR-33 fix): a non-partial `(mcpId, userId)` index would treat
// every ExternalUser-subject connection's missing `userId` as `null`,
// colliding across unrelated connections that merely share an mcpId.
mcpUserConnectionSchema.index(
  { mcpId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } }
);
mcpUserConnectionSchema.index(
  { domain: 1, mcpId: 1, externalUserId: 1 },
  { unique: true, partialFilterExpression: { externalUserId: { $exists: true } } }
);

const McpUserConnection = mongoose.model('McpUserConnection', mcpUserConnectionSchema);

export default McpUserConnection;
