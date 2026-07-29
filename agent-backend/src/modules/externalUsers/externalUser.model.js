import mongoose from 'mongoose';

/**
 * ExternalUser (Developer Platform, AD-02).
 *
 * A minimal internal anchor for `(Project, externalUserId)` — NOT a full
 * "User" document, and never a Persona account, Clerk account, or Project
 * membership (AD-02 §4, §9; AD-08's Membership is a wholly separate,
 * human-only concept).
 *
 * `externalUserId` is the Project-supplied, stable, opaque identity
 * (AD-02 §11.4/§12) — the Project is authoritative for it; this record
 * never independently verifies it, only anchors it. `project` +
 * `externalUserId` together ARE the identity; everything else on this
 * document is optional, soft, "latest write wins" display metadata
 * (`displayName`/`email`/`avatarUrl`) that must NEVER be used for scoping
 * or authorization (AD-02 §12) — only the compound key is ever used for
 * that purpose.
 *
 * This model is not yet consumed by any route or the auth middleware —
 * see the master implementation blueprint §11, §34 Phase 5.
 */

const externalUserSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    externalUserId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Soft display metadata only — never identity, never authorization-
    // relevant (AD-02 §12). Re-asserted per request, latest-write-wins.
    displayName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 320,
      default: '',
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: '',
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// The hard non-collision guarantee: (BeyondCampus, "rahul") and
// (Coursify, "rahul") are always distinct documents, never the same one.
externalUserSchema.index({ project: 1, externalUserId: 1 }, { unique: true });

const ExternalUser = mongoose.model('ExternalUser', externalUserSchema);

export default ExternalUser;
