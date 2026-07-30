import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema(
  {
    // Developer Platform (AD-03, AD-04 §18): same additive pattern as
    // Agent (agent.model.js) — defaults keep every existing/unmodified
    // creation path correct with zero controller changes. See that file
    // for the full rationale; not repeated here.
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
    // Developer Platform (AD-04, blueprint Phase 9, PR-27): same
    // conditional-required generalization as Agent (agent.model.js) — only
    // required for `ownerType: 'PersonaUser'`. No separate identity field
    // is needed for `ownerType: 'Project'` (the Skill's own `domain`
    // already IS the Project's identity); `externalOwnerId` below covers
    // `ownerType: 'ExternalUser'`.
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.ownerType === 'PersonaUser';
      },
      index: true,
    },
    // Developer Platform (AD-02 §11.1, blueprint Phase 9, PR-27): mirrors
    // Agent's own `externalOwnerId` (PR-24) and Thread's `externalUserId`
    // (PR-22) exactly — the raw asserted externalUserId string, never an
    // internal ExternalUser document `_id`.
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
      maxlength: 64,
      lowercase: true,
      match: /^[a-z0-9-]+$/, // Must contain only lowercase letters, numbers, and hyphens (per Claude specs)
    },
    description: {
      type: String,
      required: true,
      maxlength: 1024,
    },
    instructions: {
      type: String,
      required: true, // The body of SKILL.md
      maxlength: 50000,
    },
    // Bundled supporting files served next to SKILL.md in the agent's
    // /skills/<slug>/ folder. Paths are relative and may be nested
    // (e.g. 'references/api.md'). Validated by utils/skillValidation.js.
    files: [
      {
        path: { type: String, required: true },
        content: { type: String, default: '' },
        mimeType: { type: String, default: 'text/plain' },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Prevent a Persona User from creating two skills with the exact same
// name. Developer Platform (blueprint Phase 9, PR-27): scoped with a
// partialFilterExpression so it only applies when `ownerId` is actually
// set. Before PR-27, `ownerId` was unconditionally required, so this was
// a no-op change for every existing document. Without the partial filter,
// a non-sparse unique index treats a *missing* `ownerId` as `null` on
// every document that lacks one — meaning two different Project- or
// ExternalUser-owned Skills sharing the same `name` (a real, likely
// scenario once those owner types exist, e.g. two Projects both naming a
// skill "customer-support") would collide with each other on this index
// and fail to save, even though they have nothing to do with one another.
skillSchema.index(
  { ownerId: 1, name: 1 },
  { unique: true, partialFilterExpression: { ownerId: { $exists: true } } }
);

const Skill = mongoose.model('Skill', skillSchema);

export default Skill;
