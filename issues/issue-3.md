---
title: "Skills Page Needs Full Redesign — Settings-Inspired Layout with Left Nav, Global Search, and Dedicated Editor"
labels: enhancement, ux, skills, redesign
assignees: []
---

## 🎨 Feature / Redesign Proposal — Skills Page UX Overhaul

### Summary

The current `/dashboard/skills` page uses a card grid + modal dialog pattern that is fundamentally ill-suited for managing skills. Skills are long-form, structured documents (`SKILL.md`-style content) that need space, discoverability, and a rich editing surface — none of which the current grid + modal provides.

The reference inspiration is the **Codex Settings UI** (see reference image): a two-column layout with a **sticky left navigation panel** (sections + global search) and a **scrollable right content area** that renders each section in full. This pattern is ideal for the Skills page because:

- Skills have multiple distinct "views" (My Skills, Public Marketplace, a specific skill's detail/edit)
- Users need to **search and filter** skills without leaving the page
- Editing a skill requires a large, comfortable editor — not a clipped modal

---

## 📸 Reference Design (Codex Settings)

The Codex settings panel has:
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to app                                              │
│  🔍 Search settings...          ← global fuzzy search       │
├──────────────────┬──────────────────────────────────────────┤
│  Personal        │                                          │
│  ● General       │   General                                │
│  ○ Profile       │   ─────────────────────────────────      │
│  ○ Appearance    │   Work mode                              │
│                  │   Choose how much detail...              │
│  Integrations    │                                          │
│  ○ MCP servers   │   ┌────────────────┐  ┌───────────────┐  │
│  ○ Browser       │   │ For coding   ● │  │ For everyday  │  │
│                  │   └────────────────┘  └───────────────┘  │
│  Coding          │                                          │
│  ○ Hooks         │   Permissions                            │
│  ○ Git           │   ─────────────────────────────────      │
│                  │   Default permissions      [toggle]      │
│  Archived        │   Auto-review              [toggle]      │
│  ○ Archived      │   Full access              [toggle]      │
└──────────────────┴──────────────────────────────────────────┘
```

Key design principles to adopt:
1. **Sticky left sidebar** with grouped navigation (My Skills / Public Marketplace / possibly per-category)
2. **Global search bar at the top of the left panel** that filters across all skills by name + description + instructions
3. **Right content panel** shows the selected skill in full detail — name, description, full instructions in a read-only `pre`/markdown block, which section it's used in, which agents use it
4. **Inline edit mode** triggered from the right panel — replaces the read view with an editable form, no modal needed
5. **Section headers** in the left nav can group skills by category or visibility (Public / Private)

---

## 🧩 Current Architecture vs. Proposed

### Current (`/dashboard/skills`)

```
skills/
  page.jsx          ← monolithic 353-line page with grid + state + modal trigger
  (no sub-routes)

components/skills/
  skill-dialog.jsx  ← modal for both create AND edit (broken for long content)
```

**Data flow:**
```
page load → getMySkills() + getPublicSkills() (parallel)
         → renders card grid
         → click Edit → opens SkillDialog (modal) → PATCH /skills/:id
```

**Problems with current layout:**
- Grid of cards → every skill looks identical, no at-a-glance information
- Clicking "Edit" opens a 600px modal in which you must write a SKILL.md document
- Search is hidden on mobile and only covers name + description (not instructions)
- No way to view a skill's full content without opening the edit modal
- No URL routing — you can't deep-link to a specific skill or share it
- Public marketplace tab is completely passive — you can't view or import public skills

---

### Proposed Architecture

```
app/dashboard/skills/
  layout.jsx            ← Two-column layout shell (left nav + right panel)
  page.jsx              ← Default right panel: "My Skills" section list
  [id]/
    page.jsx            ← Skill detail view (read-only)
    edit/
      page.jsx          ← Full-page skill editor
  new/
    page.jsx            ← Full-page skill creator
  public/
    page.jsx            ← Public marketplace panel

components/skills/
  skills-nav.jsx        ← Left navigation panel with search
  skill-detail.jsx      ← Right panel: read view of a skill
  skill-editor.jsx      ← Right panel: full-height editor form
  skill-card-row.jsx    ← Row item in the left nav list (replacing card grid)
```

---

## 🔍 Core Feature: Global Skill Search

### What it should do

The search bar sits at the top of the left navigation panel (like VS Code's command palette or the Codex "Search settings..." box). It filters the entire left nav list in real time.

**Search should cover:**
- Skill `name`
- Skill `description`
- Skill `instructions` content (full-text — requires backend support)

**Current search gap:**
```jsx
// page.jsx  Lines 155-163 — client-side only, name + description only
const filteredMySkills = mySkills.filter((s) =>
  s.name.toLowerCase().includes(search.toLowerCase()) ||
  s.description.toLowerCase().includes(search.toLowerCase())
  // instructions NOT searched — user cannot find a skill by its content
);
```

If a user remembers writing "use Tavily for web search" in a skill's instructions but forgets the name, the current search will never find it.

**Proposed backend change:**
```js
// NEW endpoint: GET /skills/search?q=<query>&scope=mine|public
// skillRepository.js — new method
async searchSkills(userId, { q, scope = 'mine', limit = 30 } = {}) {
  const filter = {
    ...(scope === 'mine' ? { ownerId: userId } : { isPublic: true }),
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { instructions: { $regex: q, $options: 'i' } },
    ],
  };
  return await Skill.find(filter).limit(limit).sort({ updatedAt: -1 });
}
```

**Frontend implementation:**
```jsx
// skills-nav.jsx
const [query, setQuery] = useState('');
const [results, setResults] = useState(null); // null = show full list

const handleSearch = useDebouncedCallback(async (q) => {
  if (!q.trim()) { setResults(null); return; }
  const res = await searchSkills({ q, scope: activeTab });
  setResults(res.data?.data || []);
}, 300);

// Show results OR full skill list depending on query
const displayList = results ?? mySkills;
```

---

## 🗂 Left Navigation Panel Design

```
┌──────────────────────────────────┐
│  🔍 Search skills...             │  ← debounced, searches name+desc+instructions
├──────────────────────────────────┤
│  My Skills (12)                  │  ← section header with count
│                                  │
│  ● data-analysis          Public │  ← active item highlighted
│  ○ web-search-assistant  Private │
│  ○ code-reviewer          Public │
│  ○ markdown-formatter    Private │
│    ...                           │
│                                  │
│  + New Skill                     │  ← CTA at bottom of my skills section
├──────────────────────────────────┤
│  Public Marketplace (48)         │  ← section header
│                                  │
│  ○ sentiment-analysis            │
│  ○ pdf-extractor                 │
│    ...                           │
└──────────────────────────────────┘
```

Each row shows:
- Icon (Cpu) + skill name (full, not truncated)
- Visibility badge (Public/Private) right-aligned
- Active/selected state via left border highlight

---

## 📄 Right Panel: Skill Detail View

When a skill is selected from the left nav, the right panel shows:

```
┌──────────────────────────────────────────────────────────┐
│  [Cpu icon]  data-analysis                    [Edit] [⋯] │
│              Public · Updated June 5, 2026               │
├──────────────────────────────────────────────────────────┤
│  Description                                             │
│  Enables the agent to perform structured data analysis   │
│  using pandas-style reasoning and chart descriptions.    │
│                                                          │
│  Instructions (SKILL.md)                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ # Data Analysis Skill                              │  │
│  │                                                    │  │
│  │ ## Overview                                        │  │
│  │ This skill teaches the agent to...                 │  │
│  │ (full scrollable markdown preview)                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Used by Agents (3)                                      │
│  ● Sage    ● Data Bot    ● Research AI                   │
└──────────────────────────────────────────────────────────┘
```

Key elements:
- **Markdown-rendered instructions** using a lightweight renderer (e.g. `react-markdown`) — not raw text in a tiny textarea
- **"Used by Agents" section** — shown here, not only during delete confirmation
- Edit and delete actions visible in header toolbar
- Fully scrollable right panel — no content clipping

---

## ✏️ Right Panel: Skill Editor (replaces the modal)

When "Edit" or "New Skill" is triggered, the right panel switches to editor mode:

```
┌──────────────────────────────────────────────────────────┐
│  Edit Skill                           [Cancel]  [Save ✓] │  ← sticky header
├──────────────────────────────────────────────────────────┤
│  Skill Name (kebab-case)                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ data-analysis                                      │  │
│  └────────────────────────────────────────────────────┘  │
│  Will be saved as: data-analysis  ← live preview hint    │
│                                                          │
│  Description                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Enables the agent to perform structured data...    │  │
│  └────────────────────────────────────────────────────┘  │
│  (0 / 1024 chars)  ← character counter                  │
│                                                          │
│  Instructions (SKILL.md)              1,240 chars        │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  # Data Analysis Skill                             │  │  ← full-height editor
│  │  (scrollable, monospace, with line numbers)        │  │     min-h-[400px]
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ⊙ Public Marketplace                                    │
│  Allow other users to discover and use this skill.       │
└──────────────────────────────────────────────────────────┘
```

- **Sticky Save/Cancel toolbar** at the top — always visible regardless of scroll position
- **Full-height instructions editor** (min 400px, max full viewport height minus header)
- **Character counter** on description (max 1024) and instructions (suggest max 50,000)
- **Live kebab-case preview** beneath name field
- Editor stays in the same URL (no modal, no navigation) — browser back/forward works

---

## 📋 Implementation Checklist

### Phase 1 — Layout Shell
- [ ] Create `frontend/src/app/dashboard/skills/layout.jsx` with two-column shell:
  - Left: `w-72 shrink-0 border-r flex flex-col` sticky panel
  - Right: `flex-1 overflow-y-auto` scrollable content area
- [ ] Create `frontend/src/components/skills/skills-nav.jsx` — left panel with search + skill list rows
- [ ] Add search input with 300ms debounce at top of left panel
- [ ] Render skill list as rows (name + visibility badge) with active highlight

### Phase 2 — Routing
- [ ] Create `frontend/src/app/dashboard/skills/[id]/page.jsx` — skill detail view
- [ ] Create `frontend/src/app/dashboard/skills/[id]/edit/page.jsx` — skill editor
- [ ] Create `frontend/src/app/dashboard/skills/new/page.jsx` — skill creator
- [ ] Create `frontend/src/app/dashboard/skills/public/page.jsx` — marketplace panel
- [ ] Remove `SkillDialog` modal entirely once pages are in place

### Phase 3 — Skill Detail Component
- [ ] Create `frontend/src/components/skills/skill-detail.jsx`
- [ ] Render `instructions` as markdown using `react-markdown` with `prose` styling
- [ ] Show "Used by Agents" list inline (call `GET /skills/:id/agents`)
- [ ] Show `Edit` and `Delete` buttons in the sticky header

### Phase 4 — Skill Editor Component
- [ ] Create `frontend/src/components/skills/skill-editor.jsx`
- [ ] Sticky `Save / Cancel` header bar
- [ ] Live kebab-case preview: `<p className="text-xs text-muted-foreground">Will be saved as: <code>{form.name}</code></p>`
- [ ] Character counters for description (`{form.description.length} / 1024`) and instructions
- [ ] Full-height instructions textarea: `className="font-mono min-h-[400px] resize-none"`
- [ ] Auto-save draft to `localStorage` to prevent data loss on accidental navigation

### Phase 5 — Backend: Skill Search Endpoint
- [ ] Add `GET /skills/search?q=&scope=mine|public` route to `skill.routes.js`
- [ ] Add `searchSkills(userId, { q, scope, limit })` to `skillRepository.js` with `$regex` on name + description + instructions
- [ ] Add `searchSkills` controller action to `skill.controller.js`
- [ ] Add `searchSkills(params)` export to `frontend/src/lib/api/skills.js`
- [ ] Add `maxlength: 50000` to `Skill.js` model `instructions` field
- [ ] Add `.max(50000)` to `skill.validator.js` `createSkillSchema` and `updateSkillSchema`

### Phase 6 — Polish
- [ ] Show empty state in right panel when no skill is selected: "← Select a skill to view details"
- [ ] Add keyboard navigation: arrow keys move through skill list, Enter opens selected
- [ ] Add `Ctrl+S` / `Cmd+S` shortcut to save from editor
- [ ] Persist last-selected skill in `sessionStorage` so refreshing restores position
- [ ] Mobile: collapse left nav into a slide-over `<Sheet>` triggered by a hamburger button

---

## 📎 Affected Files

| File | Action |
|------|--------|
| `frontend/src/app/dashboard/skills/page.jsx` | Replace monolithic page with layout shell + redirect to first skill |
| `frontend/src/app/dashboard/skills/layout.jsx` | **New** — two-column shell |
| `frontend/src/app/dashboard/skills/[id]/page.jsx` | **New** — skill detail route |
| `frontend/src/app/dashboard/skills/[id]/edit/page.jsx` | **New** — skill editor route |
| `frontend/src/app/dashboard/skills/new/page.jsx` | **New** — skill creator route |
| `frontend/src/app/dashboard/skills/public/page.jsx` | **New** — marketplace route |
| `frontend/src/components/skills/skills-nav.jsx` | **New** — left panel with search + list |
| `frontend/src/components/skills/skill-detail.jsx` | **New** — read-only detail panel |
| `frontend/src/components/skills/skill-editor.jsx` | **New** — full-page editor |
| `frontend/src/components/skills/skill-dialog.jsx` | **Delete** once new pages are live |
| `frontend/src/lib/api/skills.js` | Add `searchSkills()` export |
| `agent-backend/src/repositories/skillRepository.js` | Add `searchSkills()` method |
| `agent-backend/src/controllers/skill.controller.js` | Add `search` action |
| `agent-backend/src/routes/skill.routes.js` | Register `GET /search` |
| `agent-backend/src/models/Skill.js` | Add `maxlength: 50000` to `instructions` |
| `agent-backend/src/validators/skill.validator.js` | Add `.max(50000)` |

---

## 🔗 Related Issues

- Issue #62: Skills modal broken for long instructions (this redesign resolves that root cause entirely)
- Reference design: Codex Settings UI (`d:\projects\agent-marketplace\image.png`)
- Settings page (good structural reference): `frontend/src/app/dashboard/settings/page.jsx`
