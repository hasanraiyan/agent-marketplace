import mongoose from 'mongoose';

/**
 * ProjectCredential (Developer Platform, AD-01/AD-08).
 *
 * `keyId` is public — safe to log, display, and index on forever.
 * `secretHash` is the ONLY thing ever stored for the secret itself (one-way,
 * via utils/credentialSecret.js) — the plaintext secret is never persisted
 * anywhere, at any point (AD-01 §9.2-9.3).
 *
 * `status` is intentionally just ACTIVE|REVOKED — revocation is one-way and
 * terminal (AD-08 §20); there is no "un-revoke" state to represent, and the
 * absence of one is itself part of the enforcement (no code path exists to
 * transition backward).
 *
 * `createdBy` records which Persona User (via ProjectAdminContext) created
 * this credential — required by AD-08 §17's central finding: credential
 * *creation* is gated to human ProjectAdminContext only, never a machine
 * credential, closing a real "leaked credential mints a persistent
 * backdoor" risk. See projectCredential.service.js for where that authority
 * check actually lives (this model does not enforce it itself).
 *
 * This model is not yet consumed by any route, controller, or existing
 * module — see the master implementation blueprint §7, §34 Phase 2.
 */

export const CREDENTIAL_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
});

const projectCredentialSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    keyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    secretHash: {
      type: String,
      required: true,
    },
    label: {
      // Display-only (e.g. "production", "staging") — organizational
      // convenience, never a security/isolation boundary (AD-08 §24).
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(CREDENTIAL_STATUS),
      default: CREDENTIAL_STATUS.ACTIVE,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const ProjectCredential = mongoose.model('ProjectCredential', projectCredentialSchema);

export default ProjectCredential;
