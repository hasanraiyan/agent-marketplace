---
title: "Dead Code & Debug-Log Cleanup — Legacy SSE Chat Path Has Zero Callers, Unused Message Model, Token Status Logged to Browser Console"
labels: chore, cleanup, backend, frontend, tech-debt
assignees: []
---

## 🧹 Cleanup Report — Two Chat Implementations, One Used

### Summary

The migration to AG-UI left a complete parallel chat stack behind, plus assorted debug logging that shouldn't ship. None of this is user-visible today, but it doubles the maintenance surface for every streaming/HITL change (e.g. the Stop-button and rate-limit issues each have to be fixed in two places as long as both paths exist).

---

## 🔍 Findings

### 1 — Legacy SSE chat endpoints have **zero frontend callers**

`frontend/src/lib/api/threads.js` exports `streamThread` / the actions caller, but a repo-wide grep shows **nothing imports them**. The chat UI exclusively uses `use-agui-chat.js` → `POST /api/v1/agui`. That leaves all of this as dead weight:

- `agent-backend/src/routes/thread.routes.js` — `POST /:id/stream`, `POST /:id/actions` (Lines 26-27)
- `agent-backend/src/services/chat.service.js` — `streamChat()` + `handleAction()` (~170 lines, Lines 56-220) duplicating the AG-UI translator with a *different, incompatible* SSE event vocabulary (`{chunk}`, `{tool}`, `{interrupt}`)
- `agent-backend/src/controllers/thread.controller.js` — `stream()` + `handleAction()` (Lines 118-140)
- `frontend/src/lib/api/threads.js` — the orphaned exports

Note: `chat.service.js` is still needed for its `checkpointer`, `getMessages()`, and `_autoTitleThread()` — only the streaming half is dead. Worth extracting the checkpointer into its own module so "chat service" can be deleted cleanly.

### 2 — `Message` model is never used anywhere

`agent-backend/src/models/Message.js` defines a full schema + index, but it's not exported from `models/index.js` and no file imports it — message history actually lives in LangGraph checkpoints. Keeping it around invites someone to write to it and create a second source of truth.

### 3 — Debug logging left in production paths

- `frontend/src/lib/api/core.js` (Lines 25-55): the axios interceptor logs **auth-token fetch status on every single API request** to the browser console (`"[Axios Interceptor] Token fetched..."`, `"WARNING: Request proceeding without Authorization header!"`). Noisy, and it advertises the app's auth mechanics to anyone who opens DevTools.
- `agent-backend/src/controllers/agent.controller.js` (Lines 29, 48): `console.log('[DEBUG] AgentController.getOne: userId=...')` on public endpoints — raw `console.log` bypassing the project's `loggerService`, logging user IDs on every agent view.

### 4 — Trivial: collision-prone fallback runId

`agui.routes.js` Line 216: `const runId = input.runId || `run-${Date.now()}``— two simultaneous runs in the same millisecond share an ID. Use`crypto.randomUUID()`.

---

## ✅ Proposed Fix

1. Delete the legacy streaming path end-to-end (routes, controller methods, `streamChat`/`handleAction`, frontend exports) **after** confirming no external consumer (mobile app? none known) hits `/threads/:id/stream`.
2. Extract `checkpointer` + `getMessages` + `_autoTitleThread` into a slim `checkpoint.service.js`; retire `chat.service.js`.
3. Delete `models/Message.js`.
4. Strip the axios-interceptor console logging (or gate behind `process.env.NODE_ENV === 'development'`); replace controller `console.log` with `logger.debug`.
5. `runId` fallback → `crypto.randomUUID()`.

---

## 📁 Files Involved

| File | Change |
|---|---|
| `agent-backend/src/services/chat.service.js` | Remove dead streaming half; extract checkpointer service |
| `agent-backend/src/controllers/thread.controller.js` | Remove `stream` / `handleAction` |
| `agent-backend/src/routes/thread.routes.js` | Remove the two routes |
| `agent-backend/src/models/Message.js` | Delete |
| `agent-backend/src/controllers/agent.controller.js` | `console.log` → `logger.debug` |
| `frontend/src/lib/api/core.js` | Remove token-status console logging |
| `frontend/src/lib/api/threads.js` | Remove orphaned exports |
| `agent-backend/src/routes/agui.routes.js` | `runId` via `crypto.randomUUID()` |
