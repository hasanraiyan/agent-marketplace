import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    // Developer Platform (AD-03, blueprint Phase 6): the Domain this
    // Thread belongs to, part of the `(domain, subject, agentId)` runtime
    // identity invariant. Defaults to Persona's own fixed first-party
    // Domain so every existing/unmodified creation path is automatically
    // correct with no controller changes. Schema-only for now — not yet
    // queried, enforced, or backfilled on this field (see agent.model.js
    // for the identical precedent from Phase 3).
    domain: {
      type: String,
      default: 'persona',
      index: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    threadId: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      default: 'New Conversation',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    // Subagent activity timelines keyed by the `task` tool call id. LangGraph
    // checkpoints only persist the main thread's messages — the subagent's
    // transcript exists only in the live event stream, so it is folded and
    // saved here to survive thread reloads.
    subagentTraces: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
