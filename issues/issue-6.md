---
title: "Pending Human-in-the-Loop Approvals Are Stored in an In-Memory Map — Lost on Restart, Broken with Multiple Instances"
labels: bug, backend, hitl, reliability, scaling
assignees: []
---

## 🐛 Bug Report — HITL Resume State Is Process-Local

### Summary

When an agent pauses for human approval (guarded tools like `upsert_agent`, `delete_agent`) or for clarification answers, the backend records "this thread is interrupted" in a **plain in-process `Map`**:

```js
// agent-backend/src/routes/agui.routes.js  Line 20-29
const interruptedThreads = new Map();
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, value] of interruptedThreads) {
    if (value.timestamp < cutoff) interruptedThreads.delete(key);
  }
}, 5 * 60 * 1000).unref();
```

The next request for that thread checks this Map to decide whether the incoming message is a **resume** (`Command({ resume })`) or a **fresh message**:

```js
// agent-backend/src/routes/agui.routes.js  Line 132-135
const pendingInterrupt =
  langGraphThreadId != null ? interruptedThreads.get(langGraphThreadId) : undefined;
const isResuming = Boolean(pendingInterrupt);
```

The actual graph interrupt is durably checkpointed in MongoDB by `MongoDBSaver` — but the *routing decision* lives only in RAM.

---

## 💥 Failure Modes

1. **Server restart / redeploy while a user has an approval card open.** The Map is wiped. The user clicks "Approve" → backend sees no pending interrupt → wraps the response as a `new HumanMessage(content)` instead of `Command({ resume })` → LangGraph receives a new message while the graph is interrupt-paused. Best case the approval is silently ignored; worst case the guarded tool never runs and the conversation state desyncs.
2. **Horizontal scaling / multiple instances.** The interrupt is registered on instance A; the resume request lands on instance B (no sticky sessions configured) → same wrong-path bug, nondeterministically. This blocks running more than one backend replica at all.
3. **Hard-coded 30-minute expiry.** A user who takes 31 minutes to answer a clarification gets the same silent failure — their answers are sent as a plain chat message.
4. The 5-minute sweep interval and TTL are magic numbers with no config.

---

## 🧠 Root Cause Analysis

The information "is this thread currently interrupt-paused, and what kind of interrupt" is already derivable from the **checkpointer** — `agentInstance.getState({ configurable })` returns `snapshot.tasks[].interrupts` / `snapshot.next`. The in-memory Map is a cache of state that MongoDB already holds authoritatively.

---

## ✅ Proposed Fix (preferred → fallback)

**Option A (stateless, preferred):** Before deciding resume-vs-new-message, ask LangGraph: load the state snapshot for `langGraphThreadId` and check for pending interrupts. Store the interrupt `kind`/`actionCount` metadata inside the interrupt payload itself (it already flows through `onInterrupt` in `aguiTranslator`), so no side-table is needed at all.

**Option B:** Persist the pending-interrupt record on the `Conversation` document (e.g. `pendingInterrupt: { kind, actionCount, at }`), set it in `onInterrupt`, clear it on resume. Survives restarts and works across instances.

Either way, delete `interruptedThreads` and its sweeper.

---

## 📁 Files Involved

| File | Change |
|---|---|
| `agent-backend/src/routes/agui.routes.js` | Replace `interruptedThreads` Map with checkpointer-derived (or DB-persisted) interrupt detection |
| `agent-backend/src/utils/aguiTranslator.js` | `buildResumeValue` may need interrupt metadata from the new source |
| `agent-backend/src/models/Conversation.js` | (Option B only) add `pendingInterrupt` subdocument |
