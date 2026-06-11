---
title: "No Cascading Deletes Anywhere — Deleted Threads Leave Full Chat History in MongoDB, Deleted Agents Orphan Threads, Deleted Users Leave API Keys Behind"
labels: bug, backend, data-integrity, privacy, storage
assignees: []
---

## 🐛 Bug Report — Every Delete Path Orphans Data

### Summary

Delete operations across the system remove only the primary document and leave all dependent data in place. Three distinct cases, worst first:

---

### Case 1 — Deleting a thread does NOT delete its conversation content (privacy issue)

`DELETE /threads/:id` tells the user **"Thread permanently removed"**:

```js
// agent-backend/src/controllers/thread.controller.js  Line 73-75
await threadRepository.delete(req.params.id);
res.json({ success: true, message: 'Thread permanently removed' });
```

But the repository only deletes the `Conversation` metadata document:

```js
// agent-backend/src/repositories/threadRepository.js  Line 44-51
async delete(id) { ... return await Conversation.findOneAndDelete(query); }
async deleteAllByUser(userId) { return await Conversation.deleteMany({ userId }); }
```

The **actual message history lives in the LangGraph checkpointer collections** (`checkpoints`, `checkpoint_writes` written by `MongoDBSaver`, keyed by `thread_id` = `Conversation.threadId`). Nothing ever deletes those. Consequences:

- A user who deletes a conversation (or uses "delete all") believes it's gone; **every message, tool call, and file remains in the database indefinitely**.
- Checkpoint collections grow **unboundedly** — each turn writes new checkpoints and they are never pruned even for live threads.
- If a new thread ever reuses a `threadId`, old state would resurrect (UUIDs make this unlikely but the data is still there).

### Case 2 — Deleting an agent orphans every conversation that used it

```js
// agent-backend/src/services/agent.service.js  Line 171-181
async deleteAgent(id, userId) {
  ...
  await agentRepository.delete(id);   // ← no cleanup of Conversations referencing this agent
}
```

`Conversation.agentId` now dangles. The sidebar **groups threads by agent** and `findByUser` does `.populate('agentId', 'name avatar slug')` → populate returns `null` → threads render under a broken/unknown group or disappear from grouping logic entirely. For **public marketplace agents**, the owner deleting the agent breaks *other users'* threads too. There's no soft-delete, no "agent deleted" placeholder, no cascade.

### Case 3 — The inactive-user cron deletes Users but nothing they own

```js
// agent-backend/src/cron/deleteInactiveUsers.js  Line 12-15
const result = await User.deleteMany({
  isActive: false,
  updatedAt: { $lt: cutoffDate },
});
```

Left behind for every purged user: their **Providers (containing encrypted third-party API keys)**, Agents (possibly public, still listed in the marketplace with a dangling `ownerId`), Skills, Conversations, and all checkpointer data. Keeping API-key material for deleted accounts is a compliance/data-retention problem, not just clutter.

---

## ✅ Proposed Fix

1. **Thread delete:** add a `checkpointCleanup` step — `MongoDBSaver` exposes the underlying collections; delete all checkpoint docs where `thread_id === conversation.threadId` inside `threadRepository.delete` / `deleteAllByUser` (use the shared Mongo client from `chat.service`).
2. **Agent delete:** choose a policy — either cascade-archive conversations (`isArchived: true` + denormalized `agentName` snapshot for display), or soft-delete agents (`deletedAt`) so populate keeps working. Update sidebar grouping to handle a "deleted agent" group gracefully.
3. **User purge cron:** make it a proper cascade — delete the user's providers, agents, skills, conversations, and checkpoints (reuse the helpers from 1 and 2), then the user document. Wrap in per-user try/catch so one failure doesn't abort the batch.
4. Add an integration test asserting that after thread deletion, no checkpoint documents remain for that `threadId`.

---

## 📁 Files Involved

| File | Change |
|---|---|
| `agent-backend/src/repositories/threadRepository.js` | Cascade checkpoint deletion in `delete` / `deleteAllByUser` |
| `agent-backend/src/services/chat.service.js` | Expose/share the Mongo client + checkpoint collection names |
| `agent-backend/src/services/agent.service.js` | Cascade or soft-delete policy in `deleteAgent` |
| `agent-backend/src/cron/deleteInactiveUsers.js` | Full ownership cascade before `User.deleteMany` |
| `frontend/src/components/nav-threads.jsx` | Graceful rendering for deleted-agent thread groups |
