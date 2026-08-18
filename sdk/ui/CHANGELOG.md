# Changelog

All notable changes to `@personaai/ui` are documented here, starting from this file's
introduction — versions before 0.2.0 aren't backfilled.

## 0.3.2

- **New: `write_todos` tool card** — `PersonaToolTrace` now special-cases the todo tool into a
  bare checklist (matching persona.hasanraiyan.me's own frontend's `TodoChecklist`): the card
  title becomes `Plan (x/y)` with no separate status badge (the title already carries it), and
  expanding it shows the checklist instead of raw JSON args/result.
- **Fixed: nested scroll containers.** `PersonaChatView` wrapped `PersonaMessageFeed` in its own
  `overflow-y-auto` div, and `PersonaMessageFeed`'s root *also* had `flex-1 overflow-y-auto` — but
  that inner div wasn't inside a flex parent (the wrapper was a plain block div), so its `flex-1`
  was dead CSS and the outer div silently did all the real scrolling. `PersonaMessageFeed` is a
  standalone exported component and should own its own scrolling; the wrapper is now a plain flex
  context with no scroll behavior of its own, and `min-h-0` was added everywhere a
  `flex-1 overflow-y-auto` container needed it to actually clip instead of growing to fit content
  (`PersonaMessageFeed`, `PersonaSidebar`'s thread list, `PersonaFilesDrawer`'s content area).

Requires `@personaai/react` ^0.3.2.

- **New: `present_file` tool card** — `PersonaToolTrace` special-cases `present_file` into a
  compact "open this file" card (icon, filename, description, Open button), matching
  persona.hasanraiyan.me's own frontend, instead of falling through to the generic
  args/result JSON accordion — which for this tool's `{status,filePath,title,description}`
  result was a raw JSON dump with no way to actually act on it. The Open button calls
  `useChat`'s new `openWorkspaceFile`, re-triggering the same drawer-open flow presenting the
  file live already does.
- **Fixed: tool card content could overflow and stretch the whole message bubble.** The
  args/result `<pre>` blocks had no `whitespace-pre-wrap`/`break-words`, and the message bubble
  had no `min-w-0` — a long unbroken value (a URL, a hash, a base64 blob) in a tool's JSON could
  force the bubble wider than its `max-w-[85%]` cap instead of wrapping inside it. Same fix
  applied to `PersonaFilesDrawer`'s memory/workspace file content viewers.

## 0.3.0

Requires `@personaai/react` ^0.3.0.

- **Fixed: sidebar toggle did nothing on mobile** — `PersonaSidebar` was hidden below the `md`
  breakpoint unconditionally (`hidden md:flex`), regardless of the toolbar's open/close toggle
  state — so on any narrow viewport the toggle button visibly did nothing. Converted the sidebar
  to a full-screen overlay (with backdrop) below `md`, docked inline at `md`+, matching the
  pattern `PersonaFilesDrawer` already used. Also defaults closed on initial mobile load instead
  of covering the whole chat.
- **Fixed: files drawer didn't scale to narrow viewports** — was a fixed 320px column regardless
  of screen size. Same overlay-below/dock-above treatment, at the `lg` breakpoint (wider than the
  sidebar's, since docking both a sidebar and a files drawer needs more room than a mid-size
  viewport has).
- **New: Workspace tab** on `PersonaFilesDrawer` — shows the agent's own virtual filesystem
  (`useChat`'s new `files`/`todos`) as a plan checklist plus a file list with content preview,
  separate from the existing "Files" (uploads) and "Memory" tabs. Auto-opens to the relevant file
  when `useChat`'s `presentedFile` is set (the agent called `present_file`) — previously there was
  no UI reacting to that at all.

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
