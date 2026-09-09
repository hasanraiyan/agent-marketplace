import mongoose from 'mongoose';

/**
 * AgentSandbox — remembers which CodeSandbox VM belongs to which
 * (agent, user) pair, so `sandbox.service.js` can resume the same VM across
 * turns instead of creating a new one every time (CodeSandbox's `create()`
 * assigns its own id; there is no "create with a name I choose" to look up
 * by later, so we have to persist the id ourselves — same reuse granularity
 * as `agent.factory.js`'s compiled-instance cache, `${agentId}:${userId}`).
 */
const agentSandboxSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    codesandboxId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const AgentSandbox = mongoose.model('AgentSandbox', agentSandboxSchema);

export default AgentSandbox;
