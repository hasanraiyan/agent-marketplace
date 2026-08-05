import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema(
  {
    // Developer Platform (AD-03, AD-04): the Domain this Agent belongs to.
    // Defaults to Persona's own fixed first-party Domain so every
    // existing/unmodified creation path is automatically correct with no
    // controller changes. Existing documents predating this field will
    // read as `undefined` until a separate backfill migration sets it
    // explicitly — this PR is schema-only and does not query, enforce, or
    // backfill on this field yet (master implementation blueprint §34
    // Phase 3).
    domain: {
      type: String,
      default: 'persona',
      index: true,
    },
    // Developer Platform (AD-04 §18, blueprint §12): who structurally owns
    // this Agent. Agents are AD-04's "richest resource type" — all three
    // owner types apply (System/Project Agents = Project, User-owned
    // Agents = PersonaUser or, once a Project's external user creates
    // one, ExternalUser). Every Agent ownership path in the current
    // codebase is a Persona Clerk user via `ownerId`, so 'PersonaUser'
    // is the correct default; no creation path sets 'Project' or
    // 'ExternalUser' yet.
    ownerType: {
      type: String,
      enum: ['PersonaUser', 'Project', 'ExternalUser'],
      default: 'PersonaUser',
    },
    // Developer Platform (AD-04, blueprint Phase 9, PR-24): only required
    // for `ownerType: 'PersonaUser'`. A `Project`-owned Agent needs no
    // separate owner identity — the Project's own Domain (`domain` above)
    // already IS the owner, unambiguous within its own Domain. An
    // `ExternalUser`-owned Agent's identity lives in `externalOwnerId`
    // below instead, since it's a raw string (never a Persona User
    // ObjectId this field could actually reference).
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.ownerType === 'PersonaUser';
      },
      index: true,
    },
    // Developer Platform (AD-02 §11.1, blueprint Phase 9, PR-24): the raw
    // asserted externalUserId string for an ExternalUser-owned Agent —
    // mirrors Thread's own `externalUserId` field (PR-22) and
    // ProjectRuntimeContext's `externalUserId` exactly (never an internal
    // ExternalUser document `_id`). `null` for every existing/PersonaUser-
    // or Project-owned Agent.
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
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      maxlength: 500,
      default: '',
    },
    avatar: {
      type: String,
      default: function () {
        // Default to a DiceBear bot avatar based on the name if no avatar provided
        return `https://res.cloudinary.com/djkpavwmp/image/upload/v1777255297/portfolio_assets/q3kcklesxkonvin1ocpi.png`;
      },
    },
    tags: [
      {
        type: String,
      },
    ],
    tagline: {
      type: String,
      maxlength: 150,
      default: '',
    },
    bio: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    personalityTraits: [
      {
        type: String,
      },
    ],
    socialLinks: {
      website: { type: String, default: '' },
      twitter: { type: String, default: '' },
      github: { type: String, default: '' },
      linkedin: { type: String, default: '' },
    },
    systemPrompt: {
      type: String,
      required: true,
      minlength: 10,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    modelName: {
      type: String,
      default: '',
    },
    webSearchEnabled: {
      type: Boolean,
      default: false,
    },
    skills: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill',
      },
    ],
    mcps: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mcp',
      },
    ],
    knowledgeBases: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KnowledgeBase',
      },
    ],
    // Named Stores this Agent mounts (see stores/store.model.js) — each
    // gets mounted at /stores/<store.name>/ in agent.factory.js, namespace
    // resolved per store.scope. Mount path is auto-derived from the
    // store's own name, not stored here, so renaming a Store's name is the
    // only thing that moves its mount path.
    storeMounts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
      },
    ],
    interruptOn: {
      type: Map,
      of: Boolean,
      default: {
        write_file: false,
        edit_file: false,
        delete_file: false,
      },
    },
    visibility: {
      type: String,
      enum: ['private', 'unlisted', 'public'],
      default: 'private',
      index: true,
    },
    category: {
      type: String,
      enum: ['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'],
      default: 'other',
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    isMainAgent: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// A user cannot have more than one active Main Agent (Clone) at a time.
agentSchema.index(
  { ownerId: 1, isMainAgent: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isMainAgent: true, isActive: true } }
);

// Ensure even existing agents without an avatar get a default one when retrieved
agentSchema.virtual('avatarUrl').get(function () {
  if (this.avatar && this.avatar.trim() !== '') {
    return this.avatar;
  }
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(this.name || 'agent')}`;
});

const Agent = mongoose.model('Agent', agentSchema);

export default Agent;
