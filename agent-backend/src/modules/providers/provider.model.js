import mongoose from 'mongoose';
import { PROVIDER_TYPES } from './provider.constants.js';

const providerSchema = new mongoose.Schema(
  {
    // Developer Platform (AD-03, AD-04 §18 / AD-06 §21: Provider
    // ownership is narrower than most resources — PersonaUser/Project
    // only, ExternalUser explicitly "not decided" and NOT included here):
    // same additive pattern as Agent (agent.model.js) — see that file
    // for the full rationale.
    domain: {
      type: String,
      default: 'persona',
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['PersonaUser', 'Project'],
      default: 'PersonaUser',
    },
    // Developer Platform (AD-04, blueprint Phase 9, PR-36): same
    // conditional-required generalization as Agent (PR-24) / Skill
    // (PR-27) / KnowledgeBase (PR-30) / Mcp (PR-33) — only required for
    // `ownerType: 'PersonaUser'`. No `externalOwnerId` counterpart here:
    // Provider's `ownerType` enum (above) never includes `'ExternalUser'`
    // (AD-06 §21), so there is no third case to support.
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.ownerType === 'PersonaUser';
      },
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    // Determines which LangChain chat model agent.factory.js constructs at
    // runtime, and which model-listing strategy provider.service.js uses.
    // Defaults to 'custom' so pre-existing rows without this field behave
    // exactly as before it was introduced.
    type: {
      type: String,
      enum: PROVIDER_TYPES,
      default: 'custom',
    },
    baseURL: {
      type: String,
      required: true,
      trim: true,
    },
    apiKeyEncrypted: {
      type: String,
      required: true,
    },
    defaultModel: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Provider = mongoose.model('Provider', providerSchema);

export default Provider;
