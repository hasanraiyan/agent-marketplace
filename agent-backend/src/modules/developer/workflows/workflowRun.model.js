import mongoose from 'mongoose';

const nodeRunSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true },
    nodeType: { type: String, required: true },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed', 'skipped', 'paused'],
      required: true,
    },
    input: { type: mongoose.Schema.Types.Mixed },
    output: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
    retriesTaken: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { _id: false }
);

const workflowRunSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    workflowVersion: { type: Number, required: true },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    triggeredBy: {
      type: {
        type: String,
        enum: ['manual', 'api', 'webhook', 'schedule', 'chat'],
        required: true,
      },
      userId: { type: String },
      details: { type: mongoose.Schema.Types.Mixed },
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'running',
      index: true,
    },
    isDryRun: {
      type: Boolean,
      default: false,
    },
    nodeRuns: [nodeRunSchema],
    pendingApproval: {
      nodeId: { type: String },
      prompt: { type: String },
      options: [String],
      requestedAt: { type: Date },
    },
    output: { type: mongoose.Schema.Types.Mixed },
    usage: {
      totalTokens: { type: Number, default: 0 },
      agentTurns: { type: Number, default: 0 },
      toolCalls: { type: Number, default: 0 },
      creditsDeducted: { type: Number, default: 0 },
    },
    threadId: { type: String, required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

workflowRunSchema.index({ projectId: 1, createdAt: -1 });
workflowRunSchema.index({ workflowId: 1, createdAt: -1 });

export default mongoose.model('WorkflowRun', workflowRunSchema);
