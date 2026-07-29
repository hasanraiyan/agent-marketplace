import mongoose from 'mongoose';

/**
 * Project (Developer Platform, AD-03/AD-04/AD-08).
 *
 * A Project IS a Domain (AD-03 §1) — its own `_id` is the immutable Domain
 * identity every other Domain-scoped resource will eventually store in its
 * own `domain` field (AD-05). No separate "domainId" field exists here.
 *
 * A Project has no human Owner (AD-08 §1/§8) — `createdBy` is audit-only
 * metadata (AD-04's Creator≠Owner principle, applied one level up), never
 * an authorization-relevant field. Administrative authority comes
 * exclusively from ProjectMembership (projectMembership.model.js), not
 * from this document.
 *
 * `slug` is display/routing convenience only, never a security identity
 * (AD-08 §14) — it is optional precisely because no current requirement
 * demands it.
 *
 * `defaultProviderId` is an inert placeholder for AD-06 §11's Project
 * default Provider/model concept — the field exists so a later phase
 * doesn't need its own migration to add it, but no resolution logic reads
 * it yet (that lands with the Provider Domain-awareness phase).
 *
 * This model is not yet consumed by any route, controller, or existing
 * module — see the master implementation blueprint §7, §34 Phase 2.
 */

export const PROJECT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETING: 'DELETING',
  DELETED: 'DELETED',
});

/** Which authority level suspended a Project — required for AD-08 §26's restore-symmetry rule. */
export const SUSPENSION_AUTHORITY = Object.freeze({
  PROJECT_ADMIN: 'ProjectAdmin',
  PLATFORM_ADMIN: 'PlatformAdmin',
});

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // optional — display/routing convenience only (AD-08 §14)
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(PROJECT_STATUS),
      default: PROJECT_STATUS.ACTIVE,
      index: true,
    },
    createdBy: {
      // Audit-only (AD-04 Creator≠Owner, AD-08 §6) — the internal Persona
      // User _id who created the Project. Never used for authorization;
      // membership (not this field) determines administrative authority.
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    defaultProviderId: {
      // Inert placeholder for AD-06 §11 — not yet resolved anywhere.
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      default: null,
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    suspendedByAuthority: {
      // Tracks WHICH authority level suspended the Project, so restoration
      // can enforce AD-08 §26: a self-suspended Project may only be
      // self-restored; a Platform-suspended Project may only be restored
      // by Platform Admin.
      type: String,
      enum: [...Object.values(SUSPENSION_AUTHORITY), null],
      default: null,
    },
    suspendedByPersonaUserId: {
      // Populated only when suspendedByAuthority === 'ProjectAdmin'.
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletionRequestedAt: {
      // Set the instant DELETING begins (AD-08 §28) — credential
      // authentication and execution must stop immediately, independent of
      // when any grace period elapses or async cleanup completes. Not
      // enforced by this model itself; consumed by later phases.
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Project = mongoose.model('Project', projectSchema);

export default Project;
