# Changelog

All notable changes to `@personaai/ui` are documented here, starting from this file's
introduction — versions before 0.2.0 aren't backfilled.

## 0.2.1

Republish of 0.2.0 — that version number was rejected by the registry (already used), no content
changes.

## 0.2.0

Requires `@personaai/react` ^0.2.0.

- **Fixed `PersonaSidebar` rename** — `PersonaChatView` never passed `onRenameThread` to
  `PersonaSidebar`, so its (already-built) rename button never rendered. Wired up.
- **Fixed `PersonaFilesDrawer`** — was reading `file._id`/`.filename`/`.sizeBytes` and
  `memory.user`, none of which exist on the real data (see `@personaai/react` 0.2.0's fixes).
  Files showed blank names/sizes, deletions didn't visually clear, and the memory panel was
  always empty. Now also renders agent-scoped memory groups (`memory.agentMemories`), which had
  no UI at all before.
- **New: `PersonaInterruptCard`** — an approve/reject card for paused HITL tool calls, and a
  question/options/free-text card for paused clarification requests. Rendered by
  `PersonaChatView` between the message feed and composer whenever `useChat`'s `interrupt` is set.
- **New: reasoning display** — `PersonaMessageFeed` shows a collapsible "Thinking…" block above
  the answer when the model streams reasoning text.
- **New: subagent activity timeline** — `PersonaToolTrace` renders a nested timeline for `task`
  (subagent) tool calls.
- **New: `isLoading` on `PersonaMessageFeed`** — a spinner state while a thread's history is
  being fetched, wired from `PersonaChatView`'s `isLoadingHistory`.
