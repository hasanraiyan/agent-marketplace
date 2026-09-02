import mongoose from 'mongoose';

/**
 * RestApiTool (no-code REST API Tool Builder, PERSONA_REST_TOOL_REQUEST.md).
 *
 * Ownership block mirrors `mcp.model.js` exactly — see that file for the
 * full Developer Platform ownership rationale (AD-03/AD-04 §18).
 *
 * Every `{{tokenName}}` placeholder that can appear in `url`,
 * `queryParams[].valueTemplate`, `headers[].valueTemplate`, or
 * `bodyTemplate` is either the single reserved token `externalUserId`
 * (resolved server-side only, see `templateEngine.js`) or an
 * agent-fillable token described in `paramDescriptors`. A document must
 * never contain a `paramDescriptors` entry named `externalUserId` —
 * enforced at save time by `restApiTool.service.js`, not by this schema,
 * so the reservation stays centralized in one place
 * (`templateEngine.RESERVED_TEMPLATE_TOKENS`).
 */

const paramRowSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    valueTemplate: { type: String, default: '' },
    description: { type: String, default: '', maxlength: 300 },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const paramDescriptorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    in: { type: String, enum: ['path', 'query', 'header', 'body'], default: 'body' },
    type: { type: String, enum: ['string', 'number', 'boolean'], default: 'string' },
    description: { type: String, default: '', maxlength: 300 },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const responseMappingSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, trim: true },
    path: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const restApiToolSchema = new mongoose.Schema(
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
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    queryParams: {
      type: [paramRowSchema],
      default: [],
    },
    headers: {
      type: [paramRowSchema],
      default: [],
    },
    bodyMode: {
      type: String,
      enum: ['none', 'json'],
      default: 'none',
    },
    bodyTemplate: {
      type: String,
      default: '',
    },
    paramDescriptors: {
      type: [paramDescriptorSchema],
      default: [],
    },
    authType: {
      type: String,
      enum: ['none', 'bearerSecret'],
      default: 'none',
    },
    secretRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectSecret',
      default: null,
    },
    responseMappings: {
      type: [responseMappingSchema],
      default: [],
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
    // Status code only — never the response body, which may contain
    // secrets/PII from the developer's own endpoint.
    lastTestedStatus: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

// Same partialFilterExpression rationale as mcp.model.js — a non-partial
// unique index would otherwise treat every Project-/ExternalUser-owned
// tool's missing `ownerId` as `null`, colliding across unrelated documents
// that merely share a `name`.
restApiToolSchema.index(
  { ownerId: 1, name: 1 },
  { unique: true, partialFilterExpression: { ownerId: { $exists: true } } }
);

const RestApiTool = mongoose.model('RestApiTool', restApiToolSchema);

export default RestApiTool;
