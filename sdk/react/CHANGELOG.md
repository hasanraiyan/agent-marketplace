# Changelog

All notable changes to `@personaai/react` are documented here, starting from this file's
introduction — versions before 0.2.0 aren't backfilled.

## 0.7.2

- **Fix: `useVoice()` transcript no longer splits one agent utterance into many lines.** Gemini
  Live delivers an utterance's `outputTranscription` as several incremental fragments within a
  single model turn, and the voice gateway forwards each as its own final transcript event — so
  the hook previously appended a new bubble per fragment ("I'm doing great, thanks! Just here…"
  rendered stacked). The hook now merges consecutive finals that share a speaker + `turnSeq` into
  the line they opened, handling both fragment shapes Gemini sends (cumulative full snapshots and
  incremental words). One utterance = one transcript line. No server/audio/AI change.

## 0.7.1

- **`useVoice({ threadId })`** — resume an existing conversation over voice. When a thread id is
  passed, the voice turns are persisted back into that thread's history so a later text message on
  it sees them. `start()` POSTs `{ agentId, threadId }`, which `@personaai/runtime`'s
  `POST /voice/sessions` (^0.7.1) forwards as the `x-thread-id` mint header.

## 0.7.0

- **New: `useVoice()`.** Real-time voice calls with an Agent, powered by Gemini Live. Mints a
  session ticket via `fetchWithAuth('/voice/sessions')` (your own backend, `POST /voice/sessions`
  on `@personaai/runtime@^0.7.0`), then opens a WebSocket **directly to Persona** with the
  returned `wsUrl` — deliberately not relayed through your backend the way `useChat` is, since a
  multi-minute bidirectional relay wouldn't survive on a serverless deployment the way `/chat`'s
  bounded SSE relay does. Owns the whole client-side audio pipeline: two `AudioWorklet`
  processors (16kHz mic capture, 24kHz playback) loaded from embedded Blob URLs — no `/public`
  file needed in the host app. Returns `{state, isMuted, transcript, partial, toolCalls, error,
  endReason, start, stop, mute, sendText}`. New types: `PersonaVoiceState`,
  `PersonaVoiceTranscriptLine`, `PersonaVoiceToolCall`, `PersonaVoiceEndReason`,
  `UseVoiceOptions`, `UseVoiceResult`.

## 0.6.0

- **New: `useThreads()` gains `resetThread(threadId)`.** `POST`s to the runtime's new
  `/threads/:id/reset` (added in `@personaai/runtime@0.6.0`) — clears a thread's message history,
  workspace files/todos, and subagent traces in place, keeping the same thread id/title, so the UI
  can offer a "clear conversation" action without the identity change `deleteThread` +
  `createThread` would force. Updates the local `threads` list in place, same pattern as
  `updateThread`.

## 0.5.4

- **Built-in logging — OFF by default, selectable via `PersonaProvider`.** New `PersonaProviderProps.logLevel`/`logger` (via `@personaai/logger@^0.1.0`, no `sdk` in browser bundle) — `fetchWithAuth` logs at `debug`/`info`/`warn`/`error`/`trace`, `useChat` logs `sendMessage` lifecycle, `loadThreadMessages`, `stop`/`clear`/`reload`/`resumeInterrupt`, and every streaming event (`TEXT_MESSAGE_CHUNK`, `TOOL_CALL_*`, `REASONING_*`, `CUSTOM` hitl/clarification, `RUN_ERROR`) at appropriate levels with child namespaces `react`/`react:chat`/`react:fetch`. Nothing logs unless caller opts in; secrets never logged.

## 0.5.3

- **Fix: the exported `VERSION` constant was stuck at `'0.4.0'`.** It had not been bumped since
  the 0.4.0 release, so 0.5.0, 0.5.1 and 0.5.2 all reported the wrong version to anything reading
  it (feature detection, bug reports, `@personaai/nextjs`'s re-export). It now tracks
  `package.json` at `'0.5.3'`.

## 0.5.2

- Rebuilt `dist` so the published artifact carried 0.5.1's sequence stamping.

## 0.5.1

- Reasoning messages and tool calls are stamped with a monotonic `seq` from a shared counter, so a
  client can place each reasoning phase chronologically against the tool calls that bracket it
  (`PersonaMessage.seq`, `PersonaToolCall.seq`).

## 0.5.0

- **Breaking: model reasoning now streams as its own messages, one per phase.** Previously
  `useChat` concatenated every `REASONING_MESSAGE_CONTENT` delta of a run into a single
  `PersonaMessage.reasoning` string on the assistant message, so an agent that reasoned, called a
  tool, reasoned again, then answered showed one giant merged "Thoughts" blob. Now each reasoning
  phase (`REASONING_MESSAGE_START` → `REASONING_MESSAGE_CONTENT` → `REASONING_END`) becomes its own
  `role: 'reasoning'` message — matching how the web timeline renders them as separate "Thoughts"
  bubbles. The SDK inserts each phase's message directly above the assistant message, so thoughts
  render above the answer rather than underneath it. Reasoning messages are excluded from the
  transcript sent back on the next `sendMessage` (they were never server transcript). On abort or
  error, any in-flight reasoning message is finalized instead of left spinning.
  - `PersonaRole` gains `'reasoning'`.
  - `PersonaMessage.reasoning` / `.isReasoning` are deprecated (kept for type-compat, no longer
    populated); consumers should render `role: 'reasoning'` messages instead.

## 0.3.5

- **Fix: a completed subagent's activity timeline was lost on thread reload.** agent-backend
  already persists and returns each subagent's folded text/tool timeline in
  `GET /threads/:id/messages`'s `subagentTraces` field (keyed by the owning `task` tool call's
  `toolCallId`) — but `loadThreadMessages` never read that field at all, so a `task` tool call
  came back from history with no `subagentActivity`, and its detail view showed "No activity
  recorded" even though the run genuinely did things. `loadThreadMessages` now matches each tool
  call's `toolCallId` against `subagentTraces` and converts the persisted folded/paired shape
  (`{type:'text',text}` / `{type:'tool',name,argsText,resultText,status}`) back into the same
  kind-based `PersonaSubagentActivityEntry[]` shape the live stream produces, so everything
  downstream (`buildSubagentTimeline`, the live-preview row, `PersonaSubagentActivityDialog` in
  `@personaai/ui`) renders identically whether the run just happened or the page was just reloaded.
  No `@personaai/ui` changes needed — purely a reload-path wiring gap in this package.

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
