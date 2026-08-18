# Changelog

All notable changes to `@personaai/react` are documented here, starting from this file's
introduction — versions before 0.2.0 aren't backfilled.

## 0.2.0

Corrects the hooks against the actual Developer Platform wire contract (`@personaai/sdk`'s real
response shapes), and closes real gaps found doing that audit — several of these are behavior
fixes, not just additions.

- **Fixed `useThreads.renameThread`** — was calling `PATCH /threads/:id/title`, which doesn't
  exist. The real endpoint is `PATCH /threads/:id` with `{ title }`. Backed by a new general
  `updateThread(id, { title?, isArchived? })`.
- **Fixed `useThreads.deleteAllThreads`** — was calling `DELETE /threads`, which doesn't exist
  either; there is no server-side "delete everything" endpoint, only bulk-delete-by-id
  (`POST /threads/bulk-delete`). Reimplemented on top of a new `bulkDeleteThreads(ids)`.
- **Fixed live tool-call rendering** — the backend streams tool calls as accumulating
  `TOOL_CALL_CHUNK` events, not the `TOOL_CALL_START`/`TOOL_CALL_ARGS` pair `useChat` was matching
  (which never appear on the wire). Tool-call cards previously never rendered during streaming.
- **Fixed `PersonaFileItem`** — real fields are `id`/`originalName`/`mimeType`/`size`, not
  `_id`/`filename`/`contentType`/`sizeBytes`. `deleteFile`'s local-state filter also compared on
  the wrong id field, so a deleted file never actually left the in-memory list.
- **Fixed `PersonaMemoryList`** — real shape is `{ userFiles, agentMemories }`, not
  `{ user, agents }`. The old shape meant `useMemory`'s data was structurally unreadable by any
  correctly-typed consumer.
- **Fixed `PersonaAgentSummary.avatarUrl`** → `avatar`, matching the real `Agent` field.
- **New: thread history loading** — `useChat` now auto-loads a thread's message history
  (`GET /threads/:id/messages`) the first time you select an existing thread with no messages in
  memory yet. Previously switching threads showed a blank chat; the messages endpoint was never
  called anywhere in the SDK.
- **New: HITL approval / clarification support** — `useChat` exposes `interrupt` (populated from
  live `CUSTOM` events or from a reloaded thread's `pendingInterrupt`) and `resumeInterrupt(resume,
  displayText)` to unpause a paused run.
- **New: reasoning / thinking text** — `PersonaMessage.reasoning` / `.isReasoning`, populated from
  `REASONING_MESSAGE_CONTENT` / `REASONING_END` events.
- **New: subagent activity** — `PersonaToolCall.subagentActivity`, populated from `CUSTOM
  subagent_activity` events on `task` (subagent) tool calls.
- **New: `bulkDeleteFiles`** on `useFiles`, mirroring the real `POST /files/bulk-delete` endpoint.
