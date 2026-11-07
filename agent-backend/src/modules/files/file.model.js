import mongoose from 'mongoose';

/**
 * Developer Platform file upload (blueprint Phase 9 §15, PR-47d).
 *
 * A NEW capability, not a retrofit of the existing avatar upload path
 * (`modules/upload`) — different purpose, different risk profile. The
 * avatar path stays exactly as-is for Persona (low risk, narrow, unrelated
 * to Project data). This is Developer/Runtime-plane only: a file always
 * belongs to a Project's own external-user Subject (AD-04 §15,
 * `ProjectRuntimeContext` — mirrors Thread's PR-39/40 Subject model
 * exactly), optionally associated with the Agent/Thread it was uploaded
 * in service of. There is no Persona/Project-machine-owned form — nothing
 * in AD-01–AD-08 calls for one.
 *
 * Retrieval is always MEDIATED (an authenticated, authorization-checked
 * download endpoint) — never a bare static URL like `/uploads/{filename}`
 * (AD-05 §20, AD-07 §22). `storageKey` is an internal on-disk filename,
 * never exposed directly to API consumers.
 */
const developerFileSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      index: true,
    },
    externalUserId: {
      type: String,
      required: true,
      index: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      default: null,
      index: true,
    },
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
      index: true,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    // 'attachment': an image sent on a chat message (agui/userContent.js) —
    // either uploaded through this API and then referenced by id, or
    // persisted from an inline AG-UI image part so checkpoints never hold
    // base64. 'generic': any other upload.
    kind: {
      type: String,
      enum: ['generic', 'attachment'],
      default: 'generic',
    },
    // LangGraph thread ids whose messages reference this file. Scopes the
    // agent's read-only /uploads/ folder (files/attachmentsBackend.js).
    threadKeys: {
      type: [String],
      default: [],
      index: true,
    },
  },
  { timestamps: true }
);

developerFileSchema.index({ domain: 1, externalUserId: 1 });

const DeveloperFile = mongoose.model('DeveloperFile', developerFileSchema);

export default DeveloperFile;
