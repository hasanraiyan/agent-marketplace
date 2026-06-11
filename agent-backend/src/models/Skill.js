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
