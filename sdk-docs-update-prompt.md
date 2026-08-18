# Task: bring agent-marketplace's SDK documentation up to date

## Repo and working directory

`D:\projects\agent-marketplace` — a monorepo containing an agent backend (`agent-backend/`), a
Next.js frontend (`frontend/`), a set of independently-published SDK packages under `sdk/`, and a
**Mintlify docs site** under `developer-docs/` that publishes to persona.hasanraiyan.me/guides/.
Work only inside this repo. Do not touch `agent-backend/`, `frontend/`, or any other top-level
folder except where explicitly listed below.

## Why this task exists

Over several sessions, two SDK packages (`sdk/react` and `sdk/ui`) went from nonexistent to fully
implemented and published — `@personaai/react` is now at v0.3.2 on npm, `@personaai/ui` is at
v0.7.3. A third, `@personaai/nestjs` (the NestJS framework adapter), also went from nonexistent to
implemented and published at v0.1.0. None of the three have **any** documentation anywhere: no
page in `developer-docs/guides/`, no entry in `developer-docs/docs.json`'s navigation, and no
`README.md` in their own package folder. Meanwhile `AGENTS.md` (the repo's main AI-agent guide)
still describes `sdk/react`, `sdk/ui`, and the nestjs adapter as "future" work that hasn't started.
This is a pure documentation task: reconcile every doc against the current, real state of the
code. Do not change any source code, do not bump any package version, do not run `npm publish` /
`pnpm publish` for anything.

## Ground truth to verify and document (re-check yourself — don't trust the numbers below blindly, they were correct when this prompt was written but may have moved on)

Run this to get current versions before writing anything:

```bash
cd D:/projects/agent-marketplace
for p in sdk/react sdk/ui sdk/typescript sdk/runtime sdk/python sdk/adapters/express sdk/adapters/nestjs; do
  if [ -f "$p/package.json" ]; then echo "$p: $(grep '"version"' $p/package.json | head -1) $(grep '"name"' $p/package.json | head -1)";
  elif [ -f "$p/pyproject.toml" ]; then echo "$p: $(grep '^version' $p/pyproject.toml | head -1)"; fi
done
```

As of the time this prompt was written:

| Folder | Package name | Version | Has docs site guide? | Has README? |
|---|---|---|---|---|
| `sdk/typescript` | `@personaai/sdk` | 0.4.2 | yes (`guides/sdk/`) | yes |
| `sdk/python` | `persona-agent-sdk` (PyPI) | 0.3.0 | yes (`guides/sdk-python/`) | yes |
| `sdk/runtime` | `@personaai/runtime` | 0.5.1 | yes (`guides/runtime/`) | yes |
| `sdk/adapters/express` | `@personaai/express` | 0.1.0 | yes (`guides/express/`) | **no** |
| `sdk/adapters/nestjs` | `@personaai/nestjs` | 0.1.0 | **no** | **no** |
| `sdk/react` | `@personaai/react` | 0.3.2 | **no** | **no** |
| `sdk/ui` | `@personaai/ui` | 0.7.3 | **no** | **no** |
| `sdk/themes/` | — | — | — | folder does not exist yet — genuinely still future work |

## Part 1 (primary deliverable): `developer-docs/guides/` — the real docs site

`developer-docs/` is a **Mintlify** site (`developer-docs/docs.json` is the Mintlify config,
`developer-docs/openapi.json` the API reference tab). Guide content lives in
`developer-docs/guides/<package>/*.mdx`, and every `.mdx` file must be explicitly listed in
`developer-docs/docs.json`'s `navigation.tabs[0].pages` array (the "Guides" tab) or it will exist
on disk but never be reachable on the published site — this is the single most important detail
to get right; a page with no `docs.json` entry is effectively invisible.

Read `developer-docs/guides/runtime/*.mdx` and `developer-docs/guides/sdk/*.mdx` in full first —
they're the best current examples of the house style (tone, frontmatter, code-sample format).
Also read `developer-docs/guides/express/*.mdx` since Express and NestJS are both thin adapters
over `@personaai/runtime` and should follow a near-identical page shape.

### 1a. `sdk/react` needs a new guide group

Create `developer-docs/guides/react/` with `.mdx` pages covering (adjust based on what
`sdk/react/src/index.ts` and `sdk/react/src/hooks/*.ts` actually export — don't invent anything,
verify every hook name, prop, and return field against the real source):
- `quickstart.mdx` — install, provider setup if any, minimal working example
- `hooks.mdx` — `useChat`, `useThreads`, `useFiles`, `useMemory`, `useAgents`, `useConnection`:
  what each returns, what each does
- `streaming.mdx` — the AG-UI streaming event shapes this package consumes (see
  `sdk/react/src/hooks/useChat.ts`'s event-handling switch for the real event types:
  `TEXT_MESSAGE_CHUNK`, `TOOL_CALL_CHUNK`, `TOOL_CALL_RESULT`, `REASONING_MESSAGE_START/CONTENT`,
  `REASONING_END`, `STATE_SNAPSHOT`, `CUSTOM` with `hitl_request`/`clarification_request`/
  `subagent_activity`/`mcp_app`)
- `types.mdx` — the exported types from `sdk/react/src/types.ts`

Then add a new group to `developer-docs/docs.json`, inside `navigation.tabs[0].pages`, following
the exact same shape as the existing `"Express Adapter"` / `"Runtime Reference"` groups:

```json
{
  "group": "React SDK Reference",
  "pages": [
    "guides/react/quickstart",
    "guides/react/hooks",
    "guides/react/streaming",
    "guides/react/types"
  ]
}
```

(Page list above is a starting suggestion, not a mandate — match it to what's actually worth a
dedicated page once you've read the source.)

### 1b. `sdk/ui` needs a new guide group

Create `developer-docs/guides/ui/` with `.mdx` pages covering (verify every prop/export against
`sdk/ui/src/index.ts`, `sdk/ui/src/types.ts`, and `sdk/ui/CHANGELOG.md` for what shipped in each
version):
- `quickstart.mdx` — install, the `@personaai/ui/styles.css` import (added in 0.7.0 — read the
  CHANGELOG entry for exactly why it exists and what it replaced), minimal `PersonaChatView`
  example
- `components.mdx` — the two full widgets (`PersonaChatView`, `PersonaChatLauncher`) plus the
  ~10 standalone building blocks (`PersonaSidebar`, `PersonaComposer`, `PersonaMessageFeed`,
  `PersonaFilesDrawer`, `PersonaMarkdown`, `PersonaToolTrace`/`PersonaToolGroup`,
  `PersonaInterruptCard`, `PersonaSkeleton`, `usePersonaChatWidget`) — what each is for and when
  to reach for the standalone pieces instead of the assembled widgets
- `theming.mdx` — the `theme` prop / `PersonaCustomTheme` shape and the `--persona-*` CSS custom
  property mechanism (every theme value is a plain CSS var with a literal fallback, so a
  consumer's own `var(--their-token)` works too and picks up their existing light/dark switching
  for free — this is a real, slightly unusual design decision worth documenting explicitly, not
  just listing the prop names)
- `launcher.mdx` — `PersonaChatLauncher`-specific: the container-query-based responsive behavior
  of the sidebar/files-drawer inside its floating panel (see CHANGELOG 0.7.3), `panelWidth`/
  `panelHeight`, `position`, controlled vs. uncontrolled `open`

Then add a new group to `developer-docs/docs.json` next to the React SDK group, same shape:

```json
{
  "group": "UI Components Reference",
  "pages": [
    "guides/ui/quickstart",
    "guides/ui/components",
    "guides/ui/theming",
    "guides/ui/launcher"
  ]
}
```

### 1c. `sdk/adapters/nestjs` needs a new guide group

`developer-docs/guides/express/` (5 pages: quickstart, routes, auth, uploads, streaming) is the
direct template — NestJS is the same kind of thin adapter over `@personaai/runtime`, just for a
different host framework. Create `developer-docs/guides/nestjs/` mirroring that page set as
closely as the actual NestJS adapter code supports (read `sdk/adapters/nestjs/src/` first; don't
assume it has 1:1 feature parity with Express — document what's actually there). Add a
`"group": "NestJS Adapter"` entry to `docs.json` next to `"Express Adapter"`.

## Part 2 (secondary): per-package `README.md`

Every SDK package should also have a short `README.md` in its own folder (this is what shows on
the npm registry page, separate from the Mintlify site). `sdk/runtime/README.md` and
`sdk/typescript/README.md` are the best existing examples — an H1 with the package name, a
one-line description, a version/status callout, an Install section, a short Quickstart, and then
**a link out to the full guide on persona.hasanraiyan.me/guides/...** rather than duplicating
everything the Mintlify pages from Part 1 already cover in depth. Create these for:
- `sdk/react/README.md`
- `sdk/ui/README.md`
- `sdk/adapters/express/README.md` (missing even though its guide pages already exist)
- `sdk/adapters/nestjs/README.md`

## Part 3: `AGENTS.md` corrections

1. **"SDK Directory Structure" section (currently around line 116–134)** lists:
   ```
   sdk/
   ├── typescript/        # @personaai/sdk — Node.js/TypeScript API client (tsup + vitest)
   ├── python/            # persona-agent-sdk — Python API client (hatchling + pytest)
   ├── runtime/           # @personaai/runtime — framework-agnostic runtime engine
   ├── adapters/          # framework adapters — express (implemented), nextjs/fastify/hono/nestjs/node future
   ├── react/             # future
   ├── ui/                # future
   └── themes/            # future
   ```
   Wrong on three counts: `adapters/nestjs` is implemented (only nextjs/fastify/hono/node remain
   future), `react/` is implemented, `ui/` is implemented. Fix the tree and its prose. `themes/`
   genuinely doesn't exist yet — check `product-research/11-sdk-new/package-ecosystem.md` (Part 4
   below) for whether it's still roadmapped before deciding whether to keep or drop that line.

2. **"Key Entry Points" table (currently around line 375–391)** has no row for `sdk/react` or
   `sdk/ui`. Add rows (e.g. `sdk/react/src/index.ts`, `sdk/ui/src/index.ts`).

## Part 4: roadmap doc

Check `product-research/11-sdk-new/package-ecosystem.md` (referenced from
`sdk/runtime/README.md` as "the SDK Ecosystem plan", mentions "Wave 3" etc.) — if it exists,
check whether it's stale relative to the same ground truth above and update it too. If any
package's CHANGELOG.md contradicts what this roadmap doc claims about its status, the CHANGELOG
(closer to the code) wins — fix the roadmap doc, not the changelog.

## Part 5: CHANGELOG sanity check

Cross-check every CHANGELOG.md under `sdk/*/CHANGELOG.md` against its package.json version —
confirm the latest CHANGELOG entry's version heading matches the current `package.json` version
for that package. Flag (don't silently fix) any mismatch you can't explain, since it might mean a
version was bumped without a changelog entry — a real gap worth a one-line CHANGELOG addition
rather than just cosmetic doc drift.

## What NOT to do

- Do not edit anything under `agent-backend/` or `frontend/`.
- Do not change any `package.json` version number.
- Do not run `npm publish`, `pnpm publish`, or any build/release command.
- Do not invent example code, prop names, or route names that don't correspond to something real
  in `src/` — verify every one against the actual source before writing it into a page.
- Do not remove or rewrite existing CHANGELOG.md entries — only append if a genuinely missing
  entry is found per Part 5, and say so explicitly when you do.
- Do not add a new `.mdx` page without also adding it to `developer-docs/docs.json` — an
  unregistered page is a page nobody will ever see.

## Deliverables checklist

- [ ] `developer-docs/guides/react/` created (pages per 1a) + registered in `docs.json`
- [ ] `developer-docs/guides/ui/` created (pages per 1b) + registered in `docs.json`
- [ ] `developer-docs/guides/nestjs/` created (pages per 1c) + registered in `docs.json`
- [ ] `sdk/react/README.md` created
- [ ] `sdk/ui/README.md` created
- [ ] `sdk/adapters/express/README.md` created
- [ ] `sdk/adapters/nestjs/README.md` created
- [ ] `AGENTS.md` SDK Directory Structure section corrected
- [ ] `AGENTS.md` Key Entry Points table has rows for `sdk/react` and `sdk/ui`
- [ ] `product-research/11-sdk-new/package-ecosystem.md` checked and updated if stale (or note
      explicitly if it doesn't exist / is already accurate)
- [ ] Every `sdk/*/CHANGELOG.md` version-checked against its `package.json`; mismatches flagged
      or fixed with a one-line note explaining which

When done, give a short summary of exactly what changed (file list), not a restatement of this
prompt.
