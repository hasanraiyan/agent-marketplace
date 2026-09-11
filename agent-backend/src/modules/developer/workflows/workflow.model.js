import mongoose from 'mongoose';

/**
 * Visual node schema embedded in Workflow draft and WorkflowVersion snapshot.
 */
export const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'trigger',
        'agentStep',
        'knowledgeStep',
        'toolStep',
        'condition',
        'approval',
        'parallel',
        'join',
        'output',
      ],
      required: true,
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    data: {
      label: { type: String, required: true },
      description: { type: String },
      config: { type: mongoose.Schema.Types.Mixed, default: {} },
      retryPolicy: {
        maxRetries: { type: Number, default: 0 },
        backoffMs: { type: Number, default: 1000 },
        exponential: { type: Boolean, default: true },
      },
      onError: {
        type: String,
        enum: ['fail', 'continue', 'routeError'],
        default: 'fail',
      },
    },
  },
  { _id: false }
);

/**
 * Visual edge schema embedded in Workflow draft and WorkflowVersion snapshot.
 */
export const edgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    sourceHandle: { type: String },
    targetHandle: { type: String },
    condition: { type: mongoose.Schema.Types.Mixed },
    conditionValue: { type: String },
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isEnabled: { type: Boolean, default: true },
    draft: {
      nodes: [nodeSchema],
      edges: [edgeSchema],
      trigger: {
        type: {
          type: String,
          enum: ['manual', 'api', 'webhook', 'schedule', 'chat'],
          default: 'manual',
        },
        config: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    },
    publishedVersion: { type: Number, default: 0 },
    activeRuns: { type: Number, default: 0 },
  },
  { timestamps: true }
);

workflowSchema.index({ projectId: 1, name: 1 });

export default mongoose.model('Workflow', workflowSchema);
