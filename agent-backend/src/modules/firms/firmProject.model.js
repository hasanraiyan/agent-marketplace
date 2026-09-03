import mongoose from 'mongoose';

/**
 * FirmProject — a project TEMPLATE the Firm sells. Every purchase stamps a
 * ClientProject (clientProject.model.js) from it, snapshotting the SOW.
 *
 * `instructions` is the creator's playbook for running the project and is
 * never exposed on public routes.
 */

export const FIRM_PROJECT_STATUS = Object.freeze({ DRAFT: 'draft', PUBLISHED: 'published' });

const deliverableSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 200 },
    acceptanceCriteria: { type: String, default: '', maxlength: 1000 },
  },
  { _id: false }
);

const inputSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, match: /^[a-zA-Z0-9_]+$/ },
    label: { type: String, required: true, maxlength: 120 },
    type: { type: String, enum: ['text', 'textarea', 'url'], default: 'text' },
    required: { type: Boolean, default: true },
    placeholder: { type: String, default: '' },
  },
  { _id: false }
);

const firmProjectSchema = new mongoose.Schema(
  {
    firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    outcome: { type: String, required: true, trim: true, maxlength: 240 },
    summary: { type: String, default: '', maxlength: 400 },
    description: { type: String, default: '', maxlength: 8000 },
    whoFor: { type: [String], default: [] },
    deliverables: { type: [deliverableSchema], default: [] },
    durationDays: { type: Number, default: 14, min: 1 },
    price: {
      amount: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD' },
      period: { type: String, enum: ['one-time', 'monthly'], default: 'one-time' },
    },
    inputs: { type: [inputSchema], default: [] },
    checkpoints: { type: [String], default: [] },
    leadAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
    skillIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
    instructions: { type: String, default: '', maxlength: 20000 },
    status: {
      type: String,
      enum: Object.values(FIRM_PROJECT_STATUS),
      default: FIRM_PROJECT_STATUS.DRAFT,
      index: true,
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

firmProjectSchema.index({ firmId: 1, slug: 1 }, { unique: true });

const FirmProject = mongoose.model('FirmProject', firmProjectSchema);
export default FirmProject;
