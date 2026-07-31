import mongoose from 'mongoose';

/**
 * AuditLog (Developer Platform, blueprint Phase 10, PR-51, AD-08 §35).
 *
 * An append-only record of every Project lifecycle event — created,
 * metadata changed, membership added/removed, credential created/revoked,
 * suspended/restored, deletion requested/cancelled/completed, Platform
 * Admin intervention. Minimum viable shape per blueprint §23: what
 * happened, when, and the actor with its context type — reusing the
 * existing MongoDB deployment (a new collection), not a new datastore.
 *
 * Never stores credential plaintext or secretHash — `metadata` is for
 * small, non-sensitive context only (e.g. a credential's `keyId`, never
 * its secret).
 *
 * No read/query API exists yet (blueprint §39/§40 — audit query surface
 * is a SHOULD-HAVE/general-release item, not MVP) — this is the write
 * path only, queryable directly against Mongo until then.
 */
const auditLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    // Free-form, not a strict enum: 'ProjectAdmin' | 'ProjectMachine' |
    // 'PlatformAdmin' today, but this must never block logging an event
    // from a context type this schema hasn't been updated for yet.
    actorContextType: {
      type: String,
      required: true,
    },
    // The acting Persona User's id (as a string) for every context type
    // this module currently logs — ProjectAdmin, ProjectMachine (via its
    // credential's own createdBy at mint time is a different actor; a
    // machine's own self-revoke logs its credentialId here instead, see
    // auditLog.service.js), and PlatformAdmin (the site-admin's own
    // Persona User id).
    actorIdentity: {
      type: String,
      required: true,
    },
    // The Project's own _id (its Domain identity) this event concerns.
    targetDomain: {
      type: String,
      required: true,
      index: true,
    },
    // The specific sub-resource affected, if any (e.g. the personaUserId
    // added/removed, or the credentialId created/revoked) — null for
    // Project-level events (create, suspend, restore, metadata update).
    targetResourceId: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: false }
);

auditLogSchema.index({ targetDomain: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
