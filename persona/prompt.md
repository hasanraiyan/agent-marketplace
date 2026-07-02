# Task: Move the chat thread list into the side drawer (match web sidebar)

## Role
You are an autonomous Flutter engineer working in the `persona/` app (the Android/Flutter
client of agent-marketplace). Pick up this file and implement the change end‑to‑end:
read the referenced files, write the code, and make sure `flutter analyze` passes.

## Problem (what's wrong today)
In the app's side drawer there is a **"Chats"** nav item. Tapping it pushes a whole
**separate page** (`ThreadListScreen`) that shows the list of conversations. This is poor
UX — the chat list should live **inside the side drawer itself**, the way the web frontend
does it, so users can see and jump between threads without leaving their current screen.

## Goal
Replace the "Chats" → separate-page pattern with an **inline, scrollable thread list
rendered directly in the side drawer**, mirroring the web design in
`frontend/src/components/`. Threads load in the sidebar, each opens its chat, and each
supports rename + delete.

---

## Reference: current Android (Flutter) implementation

- **Side drawer / shell** — `lib/features/shell/presentation/pages/main_shell.dart`
  - `_SideDrawer` (`main_shell.dart:132`) builds the drawer: logo → `_CreateAgentButton`
    → nav tiles (`_navItems`) → spacer → secondary tiles (Settings / Help) → user footer.
  - `_navItems` (`main_shell.dart:52`) currently contains **Explore, Chats, My Agents,
    Connectors**. The **"Chats"** item routes to `RouteNames.chats` (`/chats`).
  - Has both a `_NarrowShell` (phone, `Drawer`) and `_WideShell` (tablet, permanent 256px
    rail). The new thread list must work in **both** (`permanent` flag is passed down).
- **Separate page to remove from the nav flow** —
  `lib/features/chat_thread/presentation/pages/thread_list_screen.dart`
  - This is the page we no longer want behind a nav button. Reuse its logic (rename sheet,
    delete confirm, dismiss-to-delete, empty/loading/error states) when building the inline
    list. Keep the file/route for now only if something else depends on it; otherwise the
    `/chats` route can be dropped (see Router below).
- **State** — `lib/features/chat_thread/presentation/providers/thread_provider.dart`
  - `threadListProvider` (`AsyncNotifier<List<ThreadModel>>`) already exposes
    `createThread`, `delete`, `deleteAll`, `renameThread`, sorted by `lastMessageAt` desc.
  - **No pagination yet** — the web has it (see below). Add `page`/`limit` + `loadMore` /
    `hasMore` if you want parity; otherwise document that it loads all at once.
- **Model** — `lib/features/chat_thread/data/models/thread_model.dart`
  - `ThreadModel` fields: `id, agentId, userId, threadId, title, lastMessageAt, isArchived,
    createdAt, updatedAt`. **`agentId` is only a String** (the API sometimes returns a
    populated agent object — see `fromJson` at `thread_model.dart:24`). The web shows the
    **agent avatar + name** per thread; to match that you must resolve the agent (see
    "Agent avatar" task).
- **Datasource** — `lib/features/chat_thread/data/datasources/thread_remote_datasource.dart`
  - `getThreads()`, `createThread()`, `updateThreadTitle()`, `deleteThread()`,
    `deleteAllThreads()`. `getThreads` does **not** currently send `page`/`limit`.
- **Routing** — `lib/core/router/router.dart` (`/chats` route at `router.dart:73`),
  `lib/core/router/route_names.dart` (`chats`, `chat`, `chatPath` at `route_names.dart:16`).
- **Chat open contract** — both `thread_list_screen.dart:120` and
  `agent_detail_screen.dart:405` open a chat with:
  `context.push(RouteNames.chatPath(thread.id), extra: {'agentId': thread.agentId})`.
  Preserve this exact contract from the new inline list.
- **Agents data (for avatars)** —
  `lib/features/agent_marketplace/presentation/providers/agent_provider.dart`
  (`marketplaceProvider`, `myAgentsProvider`, `agentDetailProvider.family`). Use these to
  look up an agent's name/avatar by id.
- **Theme** — `lib/core/theme/colors.dart`, `lib/core/theme/typography.dart` (already used
  throughout `main_shell.dart`). Match the existing drawer styling, don't invent new colors.

## Reference: web (the design to mirror — DO NOT port React, just match UX)

- `frontend/src/components/app-sidebar.jsx` — sidebar composition:
  header (logo) → `NavMain` → **`NavThreads`** → `NavSecondary` (Settings/Help, `mt-auto`)
  → footer (`NavUser`). Note the threads list sits **between** primary nav and the
  settings/help section, and takes the remaining vertical space.
- `frontend/src/components/nav-threads.jsx` — the behavior to replicate:
  - A collapsible **"Threads"** group label with a chevron.
  - All threads **flattened and sorted by recency** (`lastMessageAt ?? createdAt`).
  - Each `ThreadItem`: small **agent avatar** + truncated **title**, **active highlight**
    when it's the open thread, and a hover/`…` menu with **Rename** (inline edit) and
    **Delete**. Deleted/orphaned agents render greyed-out and non-navigable.
  - **Scrollable** inner area; **"Load More Chats"** button when `hasMore`.
  - **Empty state** ("No threads yet. Start a conversation!") and **loading skeleton**.
- `frontend/src/components/threads-context.jsx` — data semantics to match:
  - Pagination `limit = 20`, `page`-based, `hasMore = newThreads.length === limit`,
    dedupe on append, `loadMore`.
  - **Optimistic** `renameThread` / `removeThread` / `removeAllThreads` with revert on error.

---

## Implementation tasks

1. **Inline thread list widget.** Create a new drawer widget (e.g.
   `lib/features/chat_thread/presentation/widgets/sidebar_thread_list.dart`,
   `ConsumerWidget`) that watches `threadListProvider` and renders the thread list
   styled to match the existing drawer tiles (`_NavTile` look in `main_shell.dart`).
   - Collapsible "Threads" / "Chats" section header with chevron.
   - Scrollable list (it shares vertical space inside the `Column`; wrap appropriately —
     `Expanded` in the drawer column — so it scrolls instead of overflowing).
   - Per-item: agent avatar (see task 4) + title + active highlight for the currently
     open thread. Determine "active" from the current route/threadId
     (`GoRouterState.of(context)`), like web reads `?threadId=`.
   - Tap → `context.push(RouteNames.chatPath(thread.id), extra: {'agentId': thread.agentId})`;
     on the narrow (phone) shell also `Navigator.of(context).pop()` to close the drawer
     first, matching how `_NavTile.onTap` pops when `!permanent`.
   - Long-press or `…` menu → **Rename** (reuse the bottom-sheet/inline rename pattern from
     `thread_list_screen.dart:174`) and **Delete** (confirm dialog from
     `thread_list_screen.dart:131`, then `threadListProvider.notifier.delete`).
   - Loading skeleton, empty state, and error+retry — reuse
     `shared/widgets/skeleton_loader.dart`, `shared/widgets/empty_state.dart`.

2. **Wire it into the drawer.** In `main_shell.dart` `_SideDrawer.build`, insert the new
   widget into the `content` Column (between the primary nav tiles and the `Spacer()` /
   secondary tiles, matching web ordering). Pass `permanent` so phone vs tablet behavior is
   right. Make the threads area take remaining space (`Expanded`) and the Settings/Help +
   footer stay pinned at the bottom — **remove the `Spacer()`** if it conflicts with
   `Expanded`.

3. **Remove the "Chats" page-nav.** Drop the **"Chats"** entry from `_navItems`
   (`main_shell.dart:52`) since the list now lives in the drawer. Re-check
   `_indexFromLocation` (`main_shell.dart:29`) and selection indices after removal.
   Decide what to do with the `/chats` route in `router.dart`/`route_names.dart`:
   - Keep `/chats/:threadId` (the actual chat screen) — it's still used by `chatPath`.
   - The `/chats` **list** route (`ThreadListScreen`) can be removed if nothing else
     references it. Grep first (`grep -rn "RouteNames.chats\b\|ThreadListScreen" lib`).

4. **Agent avatar/name per thread (to match web).** `ThreadModel.agentId` is a String.
   To show the agent's avatar + name like `nav-threads.jsx`:
   - Preferred: extend `ThreadModel.fromJson` to also capture the populated agent object
     (name/avatar) when the API returns it (see the `agentData is Map` branch at
     `thread_model.dart:27`) — add optional `agentName` / `agentAvatarUrl` fields.
   - Fallback: resolve via `agent_provider.dart` (e.g. a lookup map from `myAgentsProvider`
     / `marketplaceProvider`). Handle deleted/missing agents with a greyed-out
     bot-icon avatar, exactly like the web's `isDeleted` path.
   - If neither is feasible without backend changes, render a generic avatar (the current
     `auto_awesome_rounded` tile) and note the limitation — **don't block** the main task.

5. **Pagination parity (optional but preferred).** Mirror `threads-context.jsx`: add
   `page`/`limit=20`, `hasMore`, `loadMore` to `threadListProvider` +
   `ThreadRemoteDatasource.getThreads` (send `page`/`limit` query params), and a
   **"Load More Chats"** button at the bottom of the list. Keep optimistic rename/delete.

## Constraints & conventions
- Match the **surrounding code style** in `main_shell.dart` and `thread_list_screen.dart`
  (Riverpod `ConsumerWidget`, `AppColors`/`AppTypography`, dark-mode via
  `Theme.of(context).brightness`). Don't introduce new theming primitives.
- Reuse existing providers and the existing chat-open contract — **don't** change the
  `chatPath` / `extra: {'agentId': ...}` signature.
- Keep behavior correct for **both** `_NarrowShell` (phone Drawer) and `_WideShell`
  (tablet permanent rail).
- This is a Flutter app (Riverpod + go_router). The web is **only a visual/UX reference** —
  do not copy React/Tailwind; translate the design into Flutter widgets.

## Acceptance criteria
- [ ] The side drawer shows the conversation list **inline**, scrollable, styled like the
      rest of the drawer.
- [ ] There is **no "Chats" nav button that opens a separate list page**.
- [ ] Tapping a thread opens its chat (`chatPath` + `agentId`) and, on phone, closes the
      drawer first. The currently open thread is highlighted.
- [ ] Rename and delete work from the sidebar (with confirm for delete), optimistic update.
- [ ] Empty, loading, and error states are handled.
- [ ] Works in both phone (Drawer) and tablet (permanent rail) layouts; Settings/Help +
      user footer stay pinned at the bottom.
- [ ] `flutter analyze` is clean; no unused imports/dead routes left behind.

## Suggested order of work
1. Build `SidebarThreadList` widget against `threadListProvider` (reuse rename/delete from
   `thread_list_screen.dart`).
2. Insert it into `_SideDrawer` and fix the Column layout (`Expanded` vs `Spacer`).
3. Remove the "Chats" nav item + reconcile `_indexFromLocation` and routes.
4. Add agent avatar resolution (task 4).
5. (Optional) Add pagination + "Load More" (task 5).
6. Run `flutter analyze` and self-review against the acceptance criteria.
