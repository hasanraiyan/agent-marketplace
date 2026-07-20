import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    // DEPRECATED: replaced by files[]. Kept so unmigrated documents still
    // expose their snippets; scripts/migrate-skill-snippets-to-files.js
    // converts and clears this field.
    codeSnippets: [
      {
        filename: String,
        code: String,
        language: { type: String, default: 'python' },
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

// Prevent users from creating two skills with the exact same name
skillSchema.index({ ownerId: 1, name: 1 }, { unique: true });

const Skill = mongoose.model('Skill', skillSchema);

export default Skill;
