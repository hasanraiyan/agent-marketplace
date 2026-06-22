# Plan: `/dashboard/connectors` route + visual redesign

## Context

The sidebar (`src/components/app-sidebar.jsx:43-44`) already labels this section **"Connectors"**, and the mobile nav header in `skills-nav.jsx:225` already says "Connectors" too — but the actual route is still `/dashboard/skills`, with MCP servers living entirely inside it as a `?tab=mcps` query-param view. The URL doesn't match the product's own naming, and the section is visually behind the rest of the dashboard (Agents, Explore), which uses cards, gradients, large radii, header search, and skeleton grids that Skills/MCP never adopted.

Goal: move this section to `/dashboard/connectors` with real routes for both Skills and MCP, and bring its visual quality up to the same bar as `/dashboard/agents`.

Decisions (confirmed with the user):
- MCP connectors get real per-item routes, matching how Skills already work — not just client-side state.
- Plural naming: `/dashboard/connectors/skills`, `/dashboard/connectors/mcps` (matches existing `/dashboard/agents`, `/dashboard/threads`-style plural routes).
- Old `/dashboard/skills/*` URLs redirect to their `/dashboard/connectors/*` equivalents.
- Scope: this pass is Skills + MCP only. Other dashboard sections are not touched.

## Current state (verified)

**Routes** — `src/app/dashboard/skills/`:
- `layout.jsx` — tab header (Skills | MCPs) + `SkillsProvider` + `SkillsNav` + content slot
- `page.jsx` — redirects to first skill if any exist
- `[id]/page.jsx`, `[id]/edit/page.jsx`, `new/page.jsx` — skill detail/edit/create
- `public/page.jsx` — public skills marketplace
- `skills-context.jsx` — shared state: `mySkills`/`publicSkills` (real API) + `mcps` (real API, added recently) + `activeTab`/`selectedMcpId`/`isCreatingMcp` (client-only UI state)

**Components** — `src/components/skills/`:
- `skill-editor.jsx`, `skill-detail.jsx` — used by the routed Skill pages
- `skills-nav.jsx` — left sidebar, both sections
- `mcp-manager.jsx` — the entire MCP experience (list + detail + create/edit form), driven by `selectedMcpId`/`isCreatingMcp` client state, no URL per MCP

**Known bug already present in `skills-nav.jsx`** (not yet hit because nobody's filed it, but real): the MCP section of the nav still reads `mcp.id`, `mcp.command`, `mcp.args` and an `icon`-keyed `MCP_ICONS` map — all leftovers from the old localStorage/stdio MCP shape. The real backend doc only has `_id` (no `id`, no `command`/`args`, no `icon`), so `key`, `isActive`, and the search filter for MCPs in the nav are currently broken. This needs fixing as part of the rebuild, not separately.

**Visual reference** (what "amazing" means here, concretely):
- `src/app/dashboard/agents/page.jsx` — responsive card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`), `rounded-3xl`/`rounded-[28px]` cards with image+gradient overlay, header-level search (`InputGroup`) via `useDashboardHeader`, skeleton grid while loading (`<Skeleton className="h-64 rounded-xl" />` ×N), and a structured empty state (icon in a rounded tile + title + description + CTA).
- `src/app/dashboard/agents/[id]/page.jsx` — detail page as a 3-column grid: 2/3 main content cards (overview, skills, system prompt) + 1/3 sidebar cards (actions, metadata key/value rows with icons), all on `rounded-3xl` cards with light borders/dividers.
- Shared chrome: `useDashboardHeader` (title/description/avatar/tabs/actions in the sticky top bar) and `site-header.jsx`.

## Target route structure

```
src/app/dashboard/connectors/
  layout.jsx              # replaces skills/layout.jsx — ConnectorsProvider + ConnectorsNav + tab header
  page.jsx                # redirect to first skill or first mcp (whichever the active tab is)
  skills/
    page.jsx               # redirect to first skill
    [id]/page.jsx
    [id]/edit/page.jsx
    new/page.jsx
    public/page.jsx
  mcps/
    page.jsx               # redirect to first mcp (or empty state)
    [id]/page.jsx          # NEW — MCP detail (currently doesn't exist as a route)
    [id]/edit/page.jsx     # NEW — MCP edit form
    new/page.jsx           # NEW — MCP create form

src/app/dashboard/skills/[[...slug]]/route.js   # thin redirector: any old /dashboard/skills/* -> /dashboard/connectors/skills/* (or /connectors/mcps/* is not reachable this way since old URLs never had per-mcp paths)
```

Renames: `skills-context.jsx` → `connectors-context.jsx` (same provider, same data, just relocated); `skills-nav.jsx` → `connectors-nav.jsx`; `mcp-manager.jsx` is **split** into `mcp-detail.jsx` and `mcp-editor.jsx` (mirroring `skill-detail.jsx`/`skill-editor.jsx`) since MCP is getting real routes and no longer needs to be one mega-component switching on internal state.

`app-sidebar.jsx:44` `url: "/dashboard/skills"` → `url: "/dashboard/connectors"`.

## Redirect strategy

Single catch-all redirect route at the old location: `src/app/dashboard/skills/[[...slug]]/page.jsx` (or `route.js` issuing a 308) that maps:
- `/dashboard/skills` → `/dashboard/connectors/skills`
- `/dashboard/skills/public` → `/dashboard/connectors/skills/public`
- `/dashboard/skills/new` → `/dashboard/connectors/skills/new`
- `/dashboard/skills/[id]` → `/dashboard/connectors/skills/[id]`
- `/dashboard/skills/[id]/edit` → `/dashboard/connectors/skills/[id]/edit`

(There's no old MCP-detail URL to redirect since none ever existed — MCP only ever lived behind `?tab=mcps`, so `/dashboard/skills?tab=mcps` redirecting to `/dashboard/connectors/mcps` covers that case too.)

## Visual redesign, section by section

1. **Connectors nav** (`connectors-nav.jsx`): keep the two-section sidebar shape, but fix the MCP-section bug (use `_id`, drop `command`/`args`/`icon` references, always render a generic `Server` icon, use `isEnabled` for the status dot — already correct field name). Switch MCP rows from `<button onClick={setSelectedMcpId}>` to real `<Link href="/dashboard/connectors/mcps/{id}">`, same pattern Skills already uses.
2. **List/landing views** (`/connectors/skills/page.jsx` redirect-or-empty, `/connectors/mcps/page.jsx` redirect-or-empty): if nothing exists yet, show the same structured empty state pattern as Agents (rounded icon tile + title + description + CTA) instead of the current bare placeholder.
3. **Detail pages** (`skill-detail.jsx`, new `mcp-detail.jsx`): adopt the Agent-detail 3-column shape — main content cards (description, instructions/connection info, tools/used-by) at 2/3 width, a right-rail "Actions" card (enable toggle, connect/test buttons, edit/delete) + metadata card (key/value rows with icons: transport, auth type, auth mode, created/updated) at 1/3 width. `rounded-3xl` cards, light borders, divided rows — match `agents/[id]/page.jsx` structure directly.
4. **Editors** (`skill-editor.jsx`, new `mcp-editor.jsx`): keep the existing field logic (nothing about the MCP OAuth flow changes), just restyle to the same card/section rhythm already used in `agent-form.jsx` (it already mirrors this aesthetic better than mcp-manager's current form did).
5. **Header**: wire both list pages through `useDashboardHeader` with a header-level search input (`InputGroup`, like Agents) instead of (or in addition to) the sidebar-only search, plus the existing tab switcher and "New Skill"/"Add Server" actions.
6. **Loading state**: replace the spinner-only loading state with a skeleton grid/list matching `agents/page.jsx`'s `<Skeleton className="h-64 rounded-xl" />` pattern.

## Implementation task list (for the next coding session)

1. Create `src/app/dashboard/connectors/` route tree (layout, skills/*, mcps/* pages) by moving + renaming existing skills files; update all internal `Link`/`router.push` paths.
2. Add the redirect route at `src/app/dashboard/skills/[[...slug]]/`.
3. Rename/move `skills-context.jsx` → `connectors-context.jsx`, update every import site (`@/app/dashboard/skills/skills-context` → new path) across `mcp-manager.jsx`-derived files, `agent-form.jsx`, `mcp-connect-banner.jsx` is unaffected (doesn't import the context), `app-sidebar.jsx` link.
4. Split `mcp-manager.jsx` into `mcp-detail.jsx` + `mcp-editor.jsx`, wire them into the new `mcps/[id]/page.jsx`, `mcps/new/page.jsx`, `mcps/[id]/edit/page.jsx`. Carry over the OAuth connect/test-connection logic as-is.
5. Fix the `_id`/`command`/`args`/`icon` bug in the new `connectors-nav.jsx` while rebuilding it as real `Link`s for MCP rows.
6. Redesign `skill-detail.jsx` and the new `mcp-detail.jsx` to the Agent-detail 3-column card layout.
7. Restyle `skill-editor.jsx` and the new `mcp-editor.jsx` to the `agent-form.jsx` section rhythm.
8. Wire `useDashboardHeader` + header search into both list pages; add skeleton-grid loading states and the structured empty-state component.
9. Update `app-sidebar.jsx`'s Connectors `url`.
10. Manual pass: click through every old bookmarkable URL to confirm the redirect lands correctly; confirm MCP OAuth connect/test-connection still works after the file moves (the backend redirect targets in `mcp.service.js` point at `${websiteUrl}/dashboard/skills?tab=mcps&...` — **must update those two redirect strings in `agent-backend/src/services/mcp.service.js`** to the new `/dashboard/connectors/mcps` path, or the post-OAuth landing will 404/redirect-loop into the old route).

## Open items to confirm during implementation (not blocking the plan)

- Exact empty-state copy/icon per section (mirror Agents' tone).
- Whether the Public Marketplace skills page also gets the card-grid treatment in this pass or stays as-is (currently out of scope per "Skills + MCP" framing, but it's the same component family).
