import mongoose from 'mongoose';
import { nodeSchema, edgeSchema } from './workflow.model.js';

const agentSnapshotSchema = new mongoose.Schema(
  {
    modelName: { type: String, required: true },
    systemPrompt: { type: String, required: true },
    tools: [{ type: String }],
    agentType: {
      type: String,
      enum: ['deepagent', 'react'],
      default: 'deepagent',
    },
  },
  { _id: false }
);

const workflowVersionSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    version: { type: Number, required: true },
    definition: {
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
    agentSnapshots: {
      type: Map,
      of: agentSnapshotSchema,
      default: {},
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

workflowVersionSchema.index({ workflowId: 1, version: 1 }, { unique: true });

export default mongoose.model('WorkflowVersion', workflowVersionSchema);
