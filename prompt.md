# Task: bring agent-marketplace's SDK documentation up to date

## Repo and working directory

`D:\projects\agent-marketplace` — a monorepo containing an agent backend (`agent-backend/`), a
Next.js frontend (`frontend/`), and a set of independently-published SDK packages under `sdk/`.
Work only inside this repo. Do not touch `agent-backend/`, `frontend/`, or any other top-level
folder except where explicitly listed below.

## Why this task exists

Over several sessions, two SDK packages (`sdk/react` and `sdk/ui`) went from nonexistent to fully
implemented and published — `@personaai/react` is now at v0.3.2 on npm, `@personaai/ui` is at
v0.7.3. Neither package has a `README.md` at all (only a `CHANGELOG.md` each), and the repo's main
AI-agent guide, `AGENTS.md`, still describes both as "future" work that hasn't started. The guide
also has stale/missing entries elsewhere. This is a pure documentation task: reconcile every doc
against the current, real state of the code. Do not change any source code, do not bump any
package version, do not run `npm publish` or `pnpm publish` for anything.

## Ground truth to verify and document (re-check all of this yourself — don't trust the numbers below blindly, they were correct as of the time this prompt was written but may have moved on)

Run this to get current versions before writing anything:

```bash
cd D:/projects/agent-marketplace
for p in sdk/react sdk/ui sdk/typescript sdk/runtime sdk/python sdk/adapters/express sdk/adapters/nestjs; do
  if [ -f "$p/package.json" ]; then echo "$p: $(grep '"version"' $p/package.json | head -1) $(grep '"name"' $p/package.json | head -1)";
  elif [ -f "$p/pyproject.toml" ]; then echo "$p: $(grep '^version' $p/pyproject.toml | head -1)"; fi
done
```

As of the time this prompt was written:

| Folder | Package name | Version | Status |
|---|---|---|---|
| `sdk/typescript` | `@personaai/sdk` | 0.4.2 | implemented, has README |
| `sdk/python` | `persona-agent-sdk` (PyPI) | 0.3.0 | implemented, has README |
| `sdk/runtime` | `@personaai/runtime` | 0.5.1 | implemented, has README |
| `sdk/adapters/express` | `@personaai/express` | 0.1.0 | implemented, **no README** |
| `sdk/adapters/nestjs` | `@personaai/nestjs` | 0.1.0 | implemented, **no README** |
| `sdk/react` | `@personaai/react` | 0.3.2 | implemented, **no README** |
| `sdk/ui` | `@personaai/ui` | 0.7.3 | implemented, **no README** |
| `sdk/themes/` | — | — | folder does not exist yet — genuinely still future work |

## What's actually wrong right now

1. **`AGENTS.md`, "SDK Directory Structure" section (currently around line 116–134)** lists:
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
   This is wrong on three counts: `adapters/nestjs` is implemented (not future — only
   nextjs/fastify/hono/node remain future), `react/` is implemented, `ui/` is implemented. Fix
   the tree and its prose to match reality. `themes/` genuinely doesn't exist yet, so it's fine
   to leave that one as future — or remove it entirely if there's no near-term plan for it
   (check `product-research/11-sdk-new/package-ecosystem.md`, described below, for whether it's
   still on the roadmap before deciding).

2. **`AGENTS.md`, "Key Entry Points" table (currently around line 375–391)** lists entry points
   for `sdk/typescript`, `sdk/python`, `sdk/runtime` but has no row for `sdk/react` or `sdk/ui`.
   Add rows for both (pick the actual main export file, e.g. `sdk/react/src/index.ts` and
   `sdk/ui/src/index.ts`).

3. **No `README.md` in `sdk/react/`, `sdk/ui/`, `sdk/adapters/express/`, or
   `sdk/adapters/nestjs/`.** Every other SDK package has one. `sdk/runtime/README.md` (421
   lines) and `sdk/typescript/README.md` (259 lines) are the two best existing examples of the
   house style — read both fully before writing anything, and match their tone/structure:
   - Package name as H1, one-line description, a version-and-status callout near the top (see
     `sdk/runtime/README.md`'s opening paragraph for the pattern: bolded current version, what's
     shipped, what's not yet implemented, links to the ecosystem plan doc).
   - An "Install" section with the real npm install command.
   - A "Quickstart" section with real, runnable example code — pull the actual public API surface
     from each package's own `src/index.ts` (exported components/hooks/types) rather than
     inventing one. Do not hand-wave example code; every snippet must reference real exported
     names.
   - For `sdk/ui` specifically: it exports two full chat widgets (`PersonaChatView`,
     `PersonaChatLauncher`) plus ~10 standalone building-block components/hooks (see
     `sdk/ui/src/index.ts` for the full export list, and `sdk/ui/CHANGELOG.md` for what each
     recent version added — theming via `PersonaCustomTheme` and CSS custom properties, skeleton
     loading states, the self-contained `dist/styles.css` build, container-query-based responsive
     sidebar/drawer). The README needs a section explaining the `theme` prop and the
     `@personaai/ui/styles.css` import, since those are the two most-missed setup steps
     historically (check `CHANGELOG.md` 0.7.0's entry for exactly why).
   - For `sdk/react` specifically: document the real hooks (`useChat`, `useThreads`, `useFiles`,
     `useMemory`, `useAgents`, `useConnection`) and their actual return shapes — read
     `sdk/react/src/hooks/*.ts` and `sdk/react/src/types.ts` directly rather than guessing; this
     package's whole reason for existing was fixing hooks that didn't match the real backend
     contract, so accuracy here matters more than usual.
   - For `sdk/adapters/express` and `sdk/adapters/nestjs`: shorter READMEs are fine (they're thin
     adapters) — cover install, how to mount it, and what it delegates to (`@personaai/runtime`).

4. **Check `product-research/11-sdk-new/package-ecosystem.md`** (referenced from
   `sdk/runtime/README.md`) — this looks like the master roadmap doc for the whole SDK
   ecosystem ("Wave 3", etc.). If it exists, check whether it's also stale relative to the same
   ground truth above (react/ui implemented, nestjs adapter implemented) and update it too. If
   any package's CHANGELOG.md contradicts what this roadmap doc claims about its status, the
   CHANGELOG (closer to the code) wins — fix the roadmap doc, not the changelog.

5. **Cross-check every CHANGELOG.md** under `sdk/*/CHANGELOG.md` against its package.json version
   — confirm the latest CHANGELOG entry's version heading matches the current `package.json`
   version for that package. Flag (don't silently fix) any mismatch you can't explain, since a
   mismatch might mean a version was bumped without a changelog entry, which is a real gap
   worth a one-line CHANGELOG addition rather than just cosmetic doc drift.

## What NOT to do

- Do not edit anything under `agent-backend/` or `frontend/`.
- Do not change any `package.json` version number.
- Do not run `npm publish`, `pnpm publish`, or any build/release command.
- Do not invent example code that doesn't correspond to a real exported symbol — verify every
  import/prop/hook name against the actual `src/` before writing it into a README.
- Do not remove or rewrite existing CHANGELOG.md entries — only append if a genuinely missing
  entry is found per item 5 above, and say so explicitly when you do.

## Deliverables checklist

- [ ] `AGENTS.md` SDK Directory Structure section corrected
- [ ] `AGENTS.md` Key Entry Points table has rows for `sdk/react` and `sdk/ui`
- [ ] `sdk/react/README.md` created
- [ ] `sdk/ui/README.md` created
- [ ] `sdk/adapters/express/README.md` created
- [ ] `sdk/adapters/nestjs/README.md` created
- [ ] `product-research/11-sdk-new/package-ecosystem.md` checked and updated if stale (or note
      explicitly if it doesn't exist / is already accurate)
- [ ] Every `sdk/*/CHANGELOG.md` version-checked against its `package.json`; mismatches flagged
      or fixed with a one-line note explaining which

When done, give a short summary of exactly what changed (file list), not a restatement of this
prompt.
