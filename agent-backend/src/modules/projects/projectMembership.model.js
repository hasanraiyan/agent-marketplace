import mongoose from 'mongoose';

/**
 * ProjectMembership (Developer Platform, AD-08).
 *
 * The `(Project, PersonaUser) -> role` relationship. v1 supports exactly
 * one role, 'Admin' (AD-08 §9) — no lesser Member/Viewer tier exists yet.
 * A Project has no special human Owner (AD-08 §8) — this is the only
 * mechanism by which a human holds administrative authority over a
 * Project, and that authority is a revocable grant, not a permanent role
 * tied to having created the Project.
 *
 * `personaUserId` attaches to the existing internal Persona User `_id`
 * (AD-08 §10) — never the external Clerk id, consistent with every other
 * identity reference in this codebase.
 *
 * This model is not yet consumed by any route, controller, or existing
 * module — see the master implementation blueprint §7, §34 Phase 2.
 */

export const MEMBERSHIP_ROLE = Object.freeze({
  ADMIN: 'Admin',
});

const projectMembershipSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    personaUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(MEMBERSHIP_ROLE),
      default: MEMBERSHIP_ROLE.ADMIN,
      required: true,
    },
  },
  { timestamps: true }
);

// One membership row per (Project, PersonaUser) pair.
projectMembershipSchema.index({ project: 1, personaUserId: 1 }, { unique: true });

const ProjectMembership = mongoose.model('ProjectMembership', projectMembershipSchema);

export default ProjectMembership;
