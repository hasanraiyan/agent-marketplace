import mongoose from 'mongoose';

/**
 * Backs MemoryFilesStore (a LangGraph BaseStore) — one document per virtual
 * memory file. Namespaces:
 *   ['users', <userId>]                       — user-global memory (all agents)
 *   ['users', <userId>, 'agents', <agentId>]  — per user + agent memory
 */
const memoryFileSchema = new mongoose.Schema(
  {
    namespace: {
      type: [String],
      required: true,
    },
    key: {
      // File path with leading slash, e.g. '/index.md', '/preferences.md'
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 200000,
    },
    mimeType: {
      type: String,
      default: 'text/markdown',
    },
  },
  { timestamps: true }
);

memoryFileSchema.index({ namespace: 1, key: 1 }, { unique: true });

const MemoryFile = mongoose.model('MemoryFile', memoryFileSchema);

export default MemoryFile;
