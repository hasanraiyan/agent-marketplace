import mongoose from 'mongoose';

const mcpUserConnectionSchema = new mongoose.Schema(
  {
    mcpId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mcp',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accessTokenEncrypted: {
      type: String,
      required: true,
    },
    refreshTokenEncrypted: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

mcpUserConnectionSchema.index({ mcpId: 1, userId: 1 }, { unique: true });

const McpUserConnection = mongoose.model('McpUserConnection', mcpUserConnectionSchema);

export default McpUserConnection;
