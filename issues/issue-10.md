---
title: "Agent Graph Is Fully Rebuilt on Every Message + a Fresh InMemoryStore Per Request Wipes DeepAgents Long-Term Memory"
labels: bug, backend, performance, agents, memory
assignees: []
---

## 🐌 Performance + Correctness Report — `agentFactory.buildAgent()` Does Everything From Scratch, Every Turn

### Summary

Every single chat message triggers the **entire agent construction pipeline**: two+ MongoDB queries, skill materialization, API-key decryption, a new `ChatOpenAI` client, and a full `createDeepAgent()` graph compilation. The factory's own docs claim caching that no longer exists — and worse, a brand-new `InMemoryStore` is created per request, which means any cross-thread memory deepagents writes to the store is **thrown away after every message**.

---

## 🔍 Exact Problems in `agent-backend/src/factories/agentFactory.js`

### 1 — Misleading docs: the LRU cache was removed but the comments stayed

```js
// Line 77-80
/**
 * Factory Method: Builds and returns the compiled DeepAgent graph instance.
 * Leverages LRU caching to avoid expensive recompilation for the same agent.  ← false
 */
```

```js
// Line 274-280
invalidate(agentId) {
  // Cache system is disabled/removed. No-op.
}
```

`agent.controller.js` still dutifully calls `agentFactory.invalidate(...)` after update/delete (Lines 69, 85) — pure dead ritual. Anyone reading the controller assumes caching exists.

### 2 — Per-request `InMemoryStore` destroys store-backed memory

```js
// Line 141-142  (inside buildAgent, runs per message)
const { InMemoryStore } = await import('@langchain/langgraph');
const store = new InMemoryStore();
...
const agentInstance = await createDeepAgent({ ..., store: store, ... });
```

Two bugs in two lines:
- A **dynamic `import()` inside the hot path** of every message (minor, but pointless).
- The `store` is the deepagents/LangGraph **long-term memory** interface. Creating a fresh one per request means anything written there (cross-thread memories, store-backed features) silently evaporates between turns. Either it should be a single shared store per process (or a persistent Mongo-backed store), or it shouldn't be passed at all.

### 3 — Full rebuild cost per message

Per turn: `agentRepository.findById` + `populate('skills')` + `providerRepository.findById` + AES decrypt + `new ChatOpenAI` + skill-file string building + `createDeepAgent()` graph compile (middleware stack, subagents, tool binding). Under even modest concurrency this is real latency added to **time-to-first-token** for every message, and it scales with skill count.

### 4 — The checkpointer Proxy band-aid hides bugs

```js
// Line 194-230 — Proxy wrapping checkpointer.putWrites
if (foundArray && foundArray.length === 0) return;   // swallow empty batches
...
} catch (err) { /* warn once, swallow forever */ }
```

Swallowing *all* `putWrites` errors (after the first warning) means **checkpoint persistence failures are invisible** — a thread can silently stop saving state mid-conversation. The empty-batch guard may be a legitimate driver workaround, but the blanket catch should be removed or made loud.

---

## ✅ Proposed Fix

1. Reintroduce a real cache: key = `agentIdStr`, value = `{ agentInstance, builtFrom: agent.updatedAt }`; invalidate on `agent.updatedAt` change (already fetched) and via `invalidate()` (make it a real eviction again). LRU with small cap (e.g. 50) since each compiled graph holds an LLM client.
2. Hoist the `InMemoryStore` to a module-level singleton **or** decide memory should persist and back it with the existing Mongo connection; never per-request.
3. Move `import('@langchain/langgraph')` to a top-level static import.
4. Narrow the Proxy: keep only the empty-batch guard, rethrow all other `putWrites` errors (or at minimum log per-error, not once-ever).
5. Delete the stale "LRU caching" doc comment if caching is intentionally not wanted — but given build cost, it is wanted.

---

## 📁 Files Involved

| File | Change |
|---|---|
| `agent-backend/src/factories/agentFactory.js` | Cache, shared store, static import, narrowed Proxy |
| `agent-backend/src/controllers/agent.controller.js` | `invalidate()` becomes meaningful again |
| `agent-backend/src/controllers/skill.controller.js` | Should also invalidate agents using an edited skill |
