import mongoose from 'mongoose';

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
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
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
