---
title: "Stop Button Doesn't Actually Stop the Agent — Backend Keeps Running (and Billing) After Client Disconnects"
labels: bug, backend, streaming, cost, agui
assignees: []
---

## 🐛 Bug Report — Agent Runs Are Uncancellable Server-Side

### Summary

When a user clicks **Stop** in the chat UI (or closes the tab, or loses network), the frontend aborts its `fetch` — but the backend **never notices**. The LangGraph agent run keeps executing on the server: the LLM keeps generating tokens, tools keep running (including web searches and agent-builder mutations), and the checkpointer keeps persisting state. The user pays for every token of a response nobody is reading.

This is both a **cost bug** (runaway LLM spend on user-supplied API keys) and a **correctness bug** (a "stopped" agent can still mutate state — e.g. the Architect's `upsert_agent` tool can fire *after* the user hit Stop).

---

## 🔍 Root Cause

### Frontend — `use-agui-chat.js` `stop()` only aborts the fetch

```js
// frontend/src/lib/agui/use-agui-chat.js  Line 632-637
const stop = useCallback(() => {
  abortRef.current?.abort();   // ← closes the HTTP response stream, client-side only
  abortRef.current = null;
  setIsRunning(false);
  ...
}, []);
```

There is no "cancel run" request to the backend. The UI says stopped; the server disagrees.

### Backend — `agui.routes.js` POST handler never watches the socket

```js
// agent-backend/src/routes/agui.routes.js  Line 211-241
aguiRouter.post('/', async (req, res, next) => {
  ...
  for await (const event of runAgentAsAguiEvents({ ... })) {
    send(event);   // ← res.write() to a possibly-dead socket; loop never breaks
  }
  ...
});
```

- No `req.on('close', ...)` / `res.on('close', ...)` handler anywhere.
- No `AbortSignal` is passed into `agentInstance.streamEvents(...)` (LangChain supports `{ signal }` in the config), so the underlying LLM/tool execution cannot be interrupted.
- `res.write()` on a destroyed socket silently buffers/drops — the event loop happily iterates the whole run to completion.

### Same problem in the legacy path — `chat.service.js`

`streamChat()` (Line 95-129) and `handleAction()` have the identical structure: a `for await` over `streamEvents` with no disconnect detection and no signal. Its 15s `keepAlive` interval (Line 101) even keeps writing to the dead socket.

---

## 💥 Impact

| Scenario | Result |
|---|---|
| User clicks Stop mid-generation | LLM continues to completion; tokens billed; tools still execute |
| User closes tab during a long tool run | Run continues unattended; HITL interrupts get registered with nobody listening |
| Flaky mobile connection drops SSE | Same as above, repeatedly, on every retry |
| Agent in a long multi-tool loop | Cannot be killed at all without restarting the server |

---

## ✅ Proposed Fix

1. In the AG-UI POST handler, create an `AbortController` per run; wire `res.on('close', () => controller.abort())`.
2. Thread `controller.signal` through `runAgentAsAguiEvents` into `agentInstance.streamEvents(input, { configurable, version, signal })`.
3. Break the `for await` loop when `res.writableEnded || res.destroyed`.
4. On abort, do **not** register a pending interrupt in `interruptedThreads`.
5. Apply the same treatment to `chat.service.streamChat` / `handleAction` (or delete that legacy path — see the dead-code issue).
6. Optional: emit a final `RUN_ERROR`/cancelled event into the checkpointer so resumed threads see a clean state.

---

## 📁 Files Involved

| File | Change |
|---|---|
| `agent-backend/src/routes/agui.routes.js` | AbortController per run, `res.on('close')`, pass signal to `streamEvents` |
| `agent-backend/src/services/chat.service.js` | Same for legacy SSE path (or remove path) |
| `frontend/src/lib/agui/use-agui-chat.js` | No change needed once server honors disconnect (abort already closes socket) |
