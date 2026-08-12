import mongoose from 'mongoose';
import { ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';

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
    // Developer Platform (AD-02, blueprint Phase 8, PR-22): which kind of
    // Subject this Thread belongs to. Defaults to 'PersonaUser' so every
    // existing/unmodified creation path keeps requiring `userId` exactly as
    // before — additive only, not yet read by any controller/service.
    subjectType: {
      type: String,
      enum: ['PersonaUser', 'ExternalUser'],
      default: 'PersonaUser',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // Only required for PersonaUser-subject Threads — an ExternalUser
      // subject (a Project's own runtime user) has no Persona User _id to
      // reference at all, only `externalUserId` below.
      required: function () {
        return this.subjectType === 'PersonaUser';
      },
      index: true,
    },
    // Developer Platform (AD-02 §11.1, blueprint Phase 8, PR-22): the raw
    // asserted externalUserId string for an ExternalUser-subject Thread —
    // mirrors ProjectRuntimeContext's own `externalUserId` field exactly
    // (never the ExternalUser document's internal Mongo `_id`, same
    // trust-chain rule developerMachineAuth.middleware.js already
    // established). `null` for every existing/PersonaUser-subject Thread.
    externalUserId: {
      type: String,
      default: null,
      // Only required for ExternalUser-subject Threads — mirrors userId's
      // conditional-required rule above, in the opposite direction.
      required: function () {
        return this.subjectType === 'ExternalUser';
      },
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

// The Architect's ("Sage") own thread is never shown in "my conversations"
// (thread.repository.js's findBySubject/countBySubject exclude it) and has
// no real Agent behind it, so it's a working scratchpad, not history worth
// keeping indefinitely. A partial TTL index lets MongoDB itself expire it 30
// days after its last message — no cron job, no app code involved. Scoped
// to agentId: ARCHITECT_AGENT_ID via partialFilterExpression, so every other
// agent's threads are completely unaffected, kept indefinitely as before.
//
// Known gap: MongoDB's TTL monitor deletes the Conversation document
// directly — it does not (and cannot) call checkpointService.cleanupThreads,
// so the matching LangGraph checkpoint documents are not purged by this
// index. They're small and harmless to leave orphaned for now; revisit with
// a periodic orphan sweep if that ever matters.
conversationSchema.index(
  { lastMessageAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 30,
    partialFilterExpression: { agentId: new mongoose.Types.ObjectId(ARCHITECT_AGENT_ID) },
    name: 'architect_thread_ttl',
  }
);

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
