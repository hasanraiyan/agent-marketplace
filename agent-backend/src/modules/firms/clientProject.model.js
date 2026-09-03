import mongoose from 'mongoose';

/**
 * ClientProject — one client's purchased project. Holds the SOW snapshot the
 * agents execute against, the deliverables ledger, the "needed from you"
 * inbox, and the activity feed the client and owner both watch.
 */

export const CLIENT_PROJECT_STATUS = Object.freeze({
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  DONE: 'done',
  CANCELLED: 'cancelled',
});

export const DELIVERABLE_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  ACCEPTED: 'accepted',
});

const sowDeliverableSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    acceptanceCriteria: { type: String, default: '' },
    status: {
      type: String,
      enum: Object.values(DELIVERABLE_STATUS),
      default: DELIVERABLE_STATUS.PENDING,
    },
    note: { type: String, default: '' },
    artifactPath: { type: String, default: '' },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const inboxItemSchema = new mongoose.Schema(
  {
    ask: { type: String, required: true, maxlength: 1000 },
    dueBy: { type: Date, default: null },
    status: { type: String, enum: ['open', 'done'], default: 'open' },
    response: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  { _id: true }
);

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['started', 'deliverable', 'request', 'response', 'note', 'accepted', 'done'],
      required: true,
    },
    message: { type: String, required: true, maxlength: 2000 },
    by: { type: String, enum: ['agent', 'client', 'owner', 'system'], default: 'agent' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const clientProjectSchema = new mongoose.Schema(
  {
    firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'FirmProject', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    outcome: { type: String, required: true },
    sow: {
      deliverables: { type: [sowDeliverableSchema], default: [] },
      durationDays: { type: Number, default: 14 },
      checkpoints: { type: [String], default: [] },
      price: {
        amount: { type: Number, default: 0 },
        currency: { type: String, default: 'USD' },
        period: { type: String, default: 'one-time' },
      },
    },
    inputs: { type: Map, of: String, default: {} },
    status: {
      type: String,
      enum: Object.values(CLIENT_PROJECT_STATUS),
      default: CLIENT_PROJECT_STATUS.ACTIVE,
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    inbox: { type: [inboxItemSchema], default: [] },
    activity: { type: [activitySchema], default: [] },
    leadAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
    startedAt: { type: Date, default: Date.now },
    dueAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

clientProjectSchema.index({ clientId: 1, lastActivityAt: -1 });
clientProjectSchema.index({ firmId: 1, status: 1, lastActivityAt: -1 });

/** Progress = accepted deliverables weigh 1, delivered 0.75, in_progress 0.25. */
export function computeProgress(deliverables = []) {
  if (!deliverables.length) return 0;
  const weight = { pending: 0, in_progress: 0.25, delivered: 0.75, accepted: 1 };
  const total = deliverables.reduce((acc, d) => acc + (weight[d.status] ?? 0), 0);
  return Math.round((total / deliverables.length) * 100);
}

const ClientProject = mongoose.model('ClientProject', clientProjectSchema);
export default ClientProject;
