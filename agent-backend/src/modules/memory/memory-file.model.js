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

/**
 * Upsert one memory file, tolerating the concurrent-insert race.
 *
 * An upsert against a unique index is not as atomic as it looks: two
 * concurrent writes for a key that does not exist yet can both fail the find
 * and both attempt the insert, and the loser gets E11000. MongoDB documents
 * this and prescribes retrying. It is very reachable here - an agent turn
 * writes several memory files at once, so a fresh namespace (a user's first
 * conversation) hits it routinely, and the failure reaches the model as a
 * failed tool call, costing it the turn.
 *
 * The retry drops `upsert`, because by then the document is known to exist.
 */
export const upsertMemoryFile = async (filter, update) => {
  try {
    return await MemoryFile.findOneAndUpdate(filter, update, { upsert: true, new: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return MemoryFile.findOneAndUpdate(filter, update, { new: true });
  }
};

export default MemoryFile;
