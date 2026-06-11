---
title: "Settings Page Needs Full Redesign — Codex-Inspired Two-Column Layout with Grouped Sections, Global Search, and Unified Profile+Providers+Danger UX"
labels: enhancement, ux, settings, redesign
assignees: []
---

## 🎨 Feature / Redesign Proposal — Settings Page UX Overhaul

### Summary

The current `/dashboard/settings` page (`settings/page.jsx`) is a simple **single-column scroll page** with two sections: "AI Providers" and "Danger Zone". It has no navigation, no search, no visual structure, and no way to discover what settings exist. 

The **Profile** page (`/dashboard/profile`) is a completely separate route with its own layout — users don't know these two pages are conceptually the same "account settings" area.

The reference design is the **Codex Settings UI**: a two-column shell with a sticky left navigation panel (grouped sections + global search) and a scrollable right content area that renders each section in full — no modals, no page jumps, everything in one place.

**Goal:** Merge profile + providers + account danger zone into a single, discoverable, searchable Settings experience.

---

## 📸 Reference Design Analysis (Codex Settings UI)

From the reference image, the Codex settings panel provides:

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to app                                                   │
│  🔍 Search settings...                 ← global fuzzy search     │
├───────────────────┬──────────────────────────────────────────────┤
│                   │                                              │
│  Personal         │   General                  ← Section title   │
│  ● General        │   ────────────────────                       │
│  ○ Profile        │                                              │
│  ○ Appearance     │   Work mode                                  │
│                   │   Choose how much detail...                  │
│  Integrations     │                                              │
│  ○ MCP servers    │   ┌─────────────┐  ┌──────────────────────┐  │
│  ○ Browser        │   │ For coding●  │  │  For everyday work   │  │
│                   │   └─────────────┘  └──────────────────────┘  │
│  Coding           │                                              │
│  ○ Hooks          │   Permissions                                │
│  ○ Git            │   ────────────────────                       │
│                   │   Default permissions          [toggle]      │
│  Archived         │   Auto-review                  [toggle]      │
│  ○ Archived       │   Full access                  [toggle]      │
│                   │                                              │
└───────────────────┴──────────────────────────────────────────────┘
```

**Key principles to adopt:**
1. **Sticky left sidebar** — always visible, grouped by category, active item highlighted
2. **Global search at top of left panel** — filters section names AND setting labels
3. **Right panel scrolls independently** — left nav stays fixed
4. **All settings in one shell** — no jumping between `/settings` and `/profile`
5. **Sections rendered fully in the right panel** — no modals for editing

---

## 🧩 Current State vs. Proposed

### Current Architecture

```
/dashboard/settings          → page.jsx (AI Providers + Danger Zone)
/dashboard/profile           → page.jsx (Profile info + stats cards)

settings/
  page.jsx         ← 159 lines, monolithic
  ProviderList.jsx ← card grid of providers + dialog trigger
  ProviderForm.jsx ← Dialog modal for add/edit provider
```

**Problems with current layout:**
| Problem | Details |
|---------|---------|
| Profile is a separate route | Users look for "account settings" and find `/profile` and `/settings` are disconnected |
| No navigation | Single scroll page — no way to jump to a specific section |
| No search | Can't type "API key" to find the provider section |
| Provider cards use a modal | `ProviderForm` is a 283-line `<Dialog>` with the same overflow risks as the skill dialog |
| Provider delete uses `window.confirm()` | `ProviderList.jsx:31` uses the browser's native confirm dialog — jarring and unthemed |
| "Loading providers..." is plain text | `page.jsx:92-94` — no skeleton, no spinner |
| Danger zone is easy to miss | Buried at bottom with no visual weight until you scroll |
| No section anchors / deep-linking | Can't send someone a link to `/dashboard/settings#providers` |

---

### Proposed Architecture

```
app/dashboard/settings/
  layout.jsx                    ← Two-column shell (left nav + right panel)
  page.jsx                      ← Redirects to /settings/profile
  profile/
    page.jsx                    ← Account & Profile section
  providers/
    page.jsx                    ← AI Providers section
    [id]/
      edit/page.jsx             ← Full-page provider editor (replaces modal)
    new/page.jsx                ← Full-page provider creator
  appearance/
    page.jsx                    ← Theme preferences (future)
  danger/
    page.jsx                    ← Danger Zone section

components/settings/
  settings-nav.jsx              ← Left sidebar with search + grouped nav items
  settings-search.jsx           ← Search bar with fuzzy match against all setting labels
```

---

## 🗂 Left Navigation Panel Design

Grouped exactly like Codex's left panel:

```
┌────────────────────────────────┐
│  🔍 Search settings...         │  ← global search input (debounced 200ms)
├────────────────────────────────┤
│  Account                       │  ← group label
│  ● Profile                     │  ← active item
│  ○ Appearance                  │
│                                │
│  Integrations                  │  ← group label
│  ○ AI Providers  (3)           │  ← count badge
│                                │
│  Data                          │  ← group label
│  ○ Chat History                │
│                                │
│  ⚠ Danger Zone                 │  ← group label (styled red)
│  ○ Delete Data                 │
└────────────────────────────────┘
```

**Implementation:**
```jsx
// settings-nav.jsx
const NAV_GROUPS = [
  {
    label: "Account",
    items: [
      { id: "profile",    label: "Profile",    icon: UserIcon,    href: "/dashboard/settings/profile" },
      { id: "appearance", label: "Appearance", icon: SunIcon,     href: "/dashboard/settings/appearance" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { id: "providers",  label: "AI Providers", icon: CpuIcon,   href: "/dashboard/settings/providers" },
    ],
  },
  {
    label: "Data",
    items: [
      { id: "history",    label: "Chat History", icon: HistoryIcon, href: "/dashboard/settings/danger" },
    ],
  },
];
```

**Search behaviour:**
- Typing in the search box filters nav items by label in real time
- If search matches "api" → "AI Providers" highlights
- If search matches "delete" → "Danger Zone / Chat History" highlights
- Matched items scroll into view; non-matching items fade (`opacity-40`)
- Pressing `Enter` navigates to the first match

---

## 📄 Section: Profile (`/settings/profile`)

Currently split across `/dashboard/profile`. Bring it into the settings shell:

```
Profile
──────────────────────────────────────────────

Avatar
  [Avatar image]  Click to upload (future)

Display Name
  ┌────────────────────────────────┐
  │ Hasan Raiyan                   │
  └────────────────────────────────┘

Email Address
  hasan@example.com   (read-only, managed by Clerk)

Member Since
  June 2026

                               [Save Changes]

────────────────────────────────────────────── 
Account Stats
  [12 Agents]  [47 Threads]  [3 Providers]
```

**Migration from `/profile`:**
- Move the `FieldGroup` form (name, age) into `settings/profile/page.jsx`
- Move the stats cards (`agents`, `threads`, `providers`) to a sub-section
- Keep `/dashboard/profile` but add a redirect: `redirect('/dashboard/settings/profile')`

---

## 📄 Section: AI Providers (`/settings/providers`)

Replace the card grid + modal pattern with a **list + inline detail panel** (or dedicated edit routes):

```
AI Providers
──────────────────────────────────────────────
Configure OpenAI-compatible providers to power your agents.

                                    [+ Add Provider]

┌─────────────────────────────────────────────────────────────┐
│  🤖 My OpenAI                         Default  [Test] [Edit] │
│     https://api.openai.com/v1                              │
│     gpt-4o                                                  │
├─────────────────────────────────────────────────────────────┤
│  🤖 Groq Cloud                                  [Test] [Edit] │
│     https://api.groq.com/openai/v1                          │
│     llama3-70b-8192                                         │
├─────────────────────────────────────────────────────────────┤
│  🤖 Local Ollama                                [Test] [Edit] │
│     http://localhost:11434/v1                               │
│     mistral                                                 │
└─────────────────────────────────────────────────────────────┘
```

**Key improvements over current `ProviderList`:**

| Current | Proposed |
|---------|---------|
| Card grid (`grid-cols-3`) — wastes space | List rows — dense, scannable |
| Edit opens a `<Dialog>` modal | Edit navigates to `/settings/providers/[id]/edit` (full page) |
| Delete uses `window.confirm()` | Delete uses a shadcn `<AlertDialog>` (already used in settings page for chat history) |
| No status indicator for test result | Green checkmark / red X persists after test connection |
| No keyboard navigation | Tab through rows, Enter to edit, Delete to remove |

**Fix `window.confirm()` (ProviderList.jsx:31):**
```jsx
// CURRENT — browser native dialog
const handleDelete = async (id) => {
  if (!confirm("Are you sure you want to delete this provider?")) return;
  // ...
};

// PROPOSED — themed AlertDialog
const [deleteTarget, setDeleteTarget] = useState(null);
// ... render <AlertDialog> with confirmation
```

---

## 📄 Section: Chat History / Danger Zone (`/settings/danger`)

Move "Danger Zone" out of the main settings scroll and into its own dedicated sub-route with a clear warning header:

```
⚠ Danger Zone
──────────────────────────────────────────────
These actions are permanent and cannot be undone.

┌─────────────────────────────────────────── bg-destructive/5 ─┐
│  Delete All Chat History                                      │
│  Permanently deletes all conversations across all agents.    │
│  This removes all thread data and agent memory state.        │
│                                                              │
│                        [Delete Complete Chat History 🗑]      │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────── bg-destructive/5 ─┐
│  Delete Account                              (future)         │
│  Permanently delete your account and all associated data.    │
│                                                              │
│                        [Delete My Account]                   │
└──────────────────────────────────────────────────────────────┘
```

**Improvements:**
- Danger Zone is now a proper route — can be deep-linked
- Delete button requires typing `"DELETE"` to confirm (instead of just `AlertDialog` OK) for extra safety
- Account deletion is a clear placeholder for a future feature
- The entire section has a red left border or header indicator so users know it's destructive before reading

---

## 🔍 Global Settings Search

Implemented in the left panel:

```jsx
// settings-nav.jsx
const [query, setQuery] = useState('');

const ALL_SEARCHABLE = [
  { label: 'Profile', keywords: ['name', 'avatar', 'email', 'age', 'account'], href: '/settings/profile' },
  { label: 'AI Providers', keywords: ['api key', 'openai', 'model', 'base url', 'provider', 'llm'], href: '/settings/providers' },
  { label: 'Chat History', keywords: ['delete', 'threads', 'conversations', 'history', 'clear'], href: '/settings/danger' },
  { label: 'Appearance', keywords: ['theme', 'dark', 'light', 'color'], href: '/settings/appearance' },
];

const filtered = query
  ? ALL_SEARCHABLE.filter(s =>
      s.label.toLowerCase().includes(query.toLowerCase()) ||
      s.keywords.some(k => k.includes(query.toLowerCase()))
    )
  : null; // null = show full nav
```

**UX behaviour:**
- Pressing `Cmd+K` / `Ctrl+K` focuses the search input (or opens a command palette)
- Pressing `Escape` clears the query
- Non-matching nav items are `opacity-40 pointer-events-none`
- Matching items auto-expand their group if collapsed

---

## 📱 Mobile Behaviour

On `< md` screens (< 768px):
- Left nav collapses to a top horizontal tab bar (scrollable, icons + short labels)
- OR: Left nav becomes a `<Sheet side="left">` triggered by a hamburger / back button
- Right panel takes full width

```jsx
// layout.jsx — responsive shell
<div className="flex h-full">
  {/* Desktop left nav */}
  <aside className="hidden md:flex w-64 shrink-0 flex-col border-r">
    <SettingsNav />
  </aside>
  
  {/* Mobile: Sheet */}
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="ghost" size="icon" className="md:hidden">
        <MenuIcon />
      </Button>
    </SheetTrigger>
    <SheetContent side="left" className="w-64 p-0">
      <SettingsNav />
    </SheetContent>
  </Sheet>

  {/* Right panel */}
  <main className="flex-1 overflow-y-auto">
    {children}
  </main>
</div>
```

---

## 📋 Implementation Checklist

### Phase 1 — Shell & Layout
- [ ] Create `frontend/src/app/dashboard/settings/layout.jsx` — two-column shell
- [ ] Create `frontend/src/components/settings/settings-nav.jsx` — left panel with grouped nav + search input
- [ ] Add `redirect('/dashboard/settings/profile')` to `settings/page.jsx`
- [ ] Wire active state: use `usePathname()` to highlight current section in left nav
- [ ] Mobile: collapse left nav into `<Sheet side="left">`

### Phase 2 — Profile Section
- [ ] Create `frontend/src/app/dashboard/settings/profile/page.jsx`
- [ ] Move form (name, age, avatar) from `/dashboard/profile/page.jsx` into the new route
- [ ] Move stats section (agents count, threads count, providers count) beneath the form
- [ ] Add `redirect()` in old `/dashboard/profile/page.jsx` → `/dashboard/settings/profile`
- [ ] Add route to `routeMap` in `site-header.jsx`

### Phase 3 — Providers Section
- [ ] Create `frontend/src/app/dashboard/settings/providers/page.jsx` — provider list (rows, not cards)
- [ ] Create `frontend/src/app/dashboard/settings/providers/new/page.jsx` — full-page provider creator
- [ ] Create `frontend/src/app/dashboard/settings/providers/[id]/edit/page.jsx` — full-page provider editor
- [ ] Replace `window.confirm()` in `ProviderList.jsx:31` with an `<AlertDialog>`
- [ ] Add connection status badge to each provider row (Tested ✅ / Untested / Failed ❌)
- [ ] Persist last test result in component state per provider

### Phase 4 — Danger Zone Section
- [ ] Create `frontend/src/app/dashboard/settings/danger/page.jsx`
- [ ] Add "type DELETE to confirm" input to chat history deletion
- [ ] Add placeholder "Delete Account" card (disabled button, future feature note)
- [ ] Move `removeAllThreads` logic from `settings/page.jsx` to `danger/page.jsx`

### Phase 5 — Global Search
- [ ] Implement `query` state in `SettingsNav` with 200ms debounce
- [ ] Define `ALL_SEARCHABLE` array with labels + keywords for each section
- [ ] Filter and dim non-matching nav items based on query
- [ ] Add `Cmd+K` / `Ctrl+K` shortcut to focus search input
- [ ] Add `Escape` to clear query

### Phase 6 — Polish
- [ ] Add section IDs and `<ScrollArea>` to right panel for smooth in-page scrolling
- [ ] Replace "Loading providers..." text (`page.jsx:92`) with `<Skeleton>` rows
- [ ] Add `title` attribute to provider base URL for truncation tooltip
- [ ] Update `routeMap` in `site-header.jsx` for all new sub-routes
- [ ] Remove `ProviderForm` dialog and `ProviderList` grid card component once new pages are live

---

## 📎 Affected Files

| File | Action |
|------|--------|
| `frontend/src/app/dashboard/settings/page.jsx` | Replace with redirect to `/settings/profile` |
| `frontend/src/app/dashboard/settings/layout.jsx` | **New** — two-column shell |
| `frontend/src/app/dashboard/settings/profile/page.jsx` | **New** — profile section |
| `frontend/src/app/dashboard/settings/providers/page.jsx` | **New** — provider list section |
| `frontend/src/app/dashboard/settings/providers/new/page.jsx` | **New** — create provider page |
| `frontend/src/app/dashboard/settings/providers/[id]/edit/page.jsx` | **New** — edit provider page |
| `frontend/src/app/dashboard/settings/danger/page.jsx` | **New** — danger zone section |
| `frontend/src/app/dashboard/settings/ProviderList.jsx` | Fix `window.confirm()` → `<AlertDialog>`; eventually delete |
| `frontend/src/app/dashboard/settings/ProviderForm.jsx` | Eventually delete once edit pages exist |
| `frontend/src/app/dashboard/profile/page.jsx` | Add redirect → `/dashboard/settings/profile` |
| `frontend/src/components/settings/settings-nav.jsx` | **New** — left nav component |
| `frontend/src/components/site-header.jsx` | Add new sub-routes to `routeMap` |

---

## 🔗 Reference & Related Issues

- Reference design: Codex Settings UI — `d:\projects\agent-marketplace\image.png`
- Related redesign: Issue #63 (Skills page Codex-style redesign uses the same two-column shell pattern)
- Current settings code: `frontend/src/app/dashboard/settings/page.jsx`
- Current profile code: `frontend/src/app/dashboard/profile/page.jsx`
- Provider list (has `window.confirm` bug): `frontend/src/app/dashboard/settings/ProviderList.jsx:31`
