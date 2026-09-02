import mongoose from 'mongoose';

/**
 * ProjectSecret — project-scoped, reversibly-encrypted secret values a
 * Project can reuse across its RestApiTool definitions (REST API Tool
 * Builder, PERSONA_REST_TOOL_REQUEST.md).
 *
 * This is deliberately the OPPOSITE trust direction from
 * `projectCredential.model.js`: a ProjectCredential authenticates a
 * request coming FROM a Project INTO Persona, so it only ever needs to be
 * verified (one-way hash, `utils/credentialSecret.js`, never reconstructed).
 * A ProjectSecret is presented BY Persona TO an external developer
 * endpoint on every outbound RestApiTool call, so Persona must be able to
 * reconstruct the plaintext at call time — it is stored with
 * `utils/encryption.js`'s reversible AES-256-GCM instead.
 *
 * `valueEncrypted` is never returned by any read endpoint, including
 * creation (unlike ProjectCredential's server-generated "shown once"
 * secret, the caller here already typed the plaintext in themselves —
 * see `projectSecret.service.js#toSafeJson`).
 */

const projectSecretSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
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
    valueEncrypted: {
      type: String,
      required: true,
    },
    createdBy: {
      // Null when created by a ProjectMachineContext (no personaUserId) —
      // unlike ProjectCredential, secret creation is not restricted to
      // ProjectAdminContext (see projectSecret.service.js's doc comment).
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

projectSecretSchema.index({ project: 1, label: 1 }, { unique: true });

const ProjectSecret = mongoose.model('ProjectSecret', projectSecretSchema);

export default ProjectSecret;
