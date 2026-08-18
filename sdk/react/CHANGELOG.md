# Changelog

All notable changes to `@personaai/react` are documented here, starting from this file's
introduction — versions before 0.2.0 aren't backfilled.

## 0.3.4

- **`SendMessageOverride.threadId` now also accepts `Promise<string | undefined>`.** `sendMessage`
  resolves it right before building the request body — after its own optimistic update (the
  user's message + a streaming placeholder) has already run synchronously. A caller can now pass
  an in-flight thread-creation promise straight through and get both an instant message and a
  real `threadId` once it exists, instead of having to choose between the two. Plain strings and
  `undefined` behave exactly as before.

## 0.3.3

- **New: `useMcpConnections({ agentId?, returnTo?, autoFetch? })`.** Until now there was no way
  for a consumer of this SDK to find out whether the current user has connected an
  `authType: 'oauth', authMode: 'user'` MCP an Agent has attached — a tool call against an
  unconnected one is silently dropped from the Agent's toolset server-side, with no signal
  anywhere in the chat stream. Calls the new `@personaai/runtime`
  `GET /agents/:id/mcp-connections` route (requires `@personaai/runtime@^0.5.2`) and returns
  `{ connections, unconnected, isLoading, error, refetch }` — `unconnected` is a convenience
  filter for the common case of just wanting what still needs a "Connect" button.

## 0.3.2

- **New: `openWorkspaceFile(path)`** on `useChat` — manually re-opens a workspace file (sets
  `presentedFile`), for UI affordances like a `present_file` tool card's "Open" button that need
  to re-trigger the same drawer-open flow the live tool call originally did.

## 0.3.1

- Fixed `PersonaWorkspaceFile`'s `createdAt`/`modifiedAt`: the wire field
  (`buildFilesTodosSnapshot` in `aguiTranslator.js`) is `created_at`/
  `modified_at` (snake_case), not camelCase — 0.3.0's type didn't match, so
  those two fields always came through `undefined` (content/size were
  unaffected, since those field names did match). `useChat` now normalizes
  both the live `STATE_SNAPSHOT` event and a reloaded thread's persisted
  state through the same mapping.

## 0.3.0

- **New: agent workspace files** — `useChat` now tracks the agent's own virtual filesystem
  (deepagents' `write_file`/`read_file` state, distinct from `useFiles`'s uploads) via `files`
  (`Record<path, PersonaWorkspaceFile>`) and `todos`, populated from `STATE_SNAPSHOT` events —
  previously typed but never actually consumed, so this data existed on the wire and went
  nowhere. Restored on thread reload too (`checkpoint.service.js` now runs the same
  `buildFilesTodosSnapshot` cleanup on `state` that the live event uses, so a reopened thread's
  workspace isn't raw LangGraph internals).
- **New: `present_file` support** — `useChat` recognizes the `present_file` tool's result and
  surfaces it as `presentedFile` (`{path, title, description}`), so the workspace file the agent
  is pointing at can actually be highlighted somewhere. Previously nothing in the SDK reacted to
  this tool at all — the whole point of "highlight this file for the user" silently went nowhere.

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
