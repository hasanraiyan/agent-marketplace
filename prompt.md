# QA brief: `@personaai/runtime` v0.5 + its new developer docs

## Context (read this first, you have no memory of how this was written)

`@personaai/runtime` (`sdk/runtime/`) is a framework-agnostic runtime engine for the Persona
Developer Platform — the shared engine every future framework adapter (`@personaai/express`,
`@personaai/nextjs`, ...) is meant to wrap. It sits on top of `@personaai/sdk` (`sdk/typescript/`) and turns
a plain `{method, path, headers, query, body}` request into the full end-user chat/thread/file/
memory route set plus an opt-in, capability-gated Project-admin surface, with SSE streaming,
reconnect/resume, and eight lifecycle hooks.

It was built from scratch across v0.1 → v0.5 in a prior session (see `sdk/runtime/README.md` for the
authoritative feature list — treat it as ground truth over anything summarized here). Two things
happened most recently and are the actual reason this QA pass exists:

1. **`sdk/typescript/` got a real bug fix and a version bump**, published to npm as `@personaai/sdk@0.4.1`:
   - Removed an accidental self-dependency in `sdk/typescript/package.json` (`"@personaai/sdk": "^0.3.1"`
     listed as its own dependency — copy-paste bleed, almost certainly from `sdk/runtime/package.json`).
   - This version bump is what actually ships `ThreadMessages.interrupt` (added in commit
     `9de241e`, source already had it, npm's `0.4.0` didn't) and a `providers.list()` JSDoc fix
     (`13aa914`) — both were sitting unpublished on `feat/ai` since before `0.4.0` was cut.
   - Verify: `cd sdk/typescript && npm view @personaai/sdk version` should print `0.4.1`, and
     `git log --oneline -3 -- package.json` should show the bump with the self-dependency removed
     in the diff.

2. **New developer docs were just written** for the runtime, mirroring the existing SDK reference's
   structure and tone: `developer-docs/guides/runtime/{quickstart,routes,capabilities,hooks,
   reconnect,errors,roadmap}.mdx`, wired into `developer-docs/docs.json` under a new
   `"Runtime Reference"` nav group (Guides tab, after "Python SDK Reference"). **These pages have
   not been reviewed by anyone or anything except the model that wrote them.** That's what you're
   here to check.

## Your task

Two independent QA passes. Do both; report findings for each separately.

### Pass 1 — `sdk/runtime/` package correctness

The package claims to be fully tested and buildable. Confirm it actually is, from a clean state:

```bash
cd sdk/runtime
pnpm install
pnpm run build       # tsup — dual ESM/CJS + .d.ts
pnpm run typecheck   # tsc --noEmit, strict, noUncheckedIndexedAccess
pnpm run lint        # eslint src test examples
pnpm test            # vitest run — expect ~147 tests, all passing
npm pack --dry-run   # confirm the published tarball is still the expected small file set (dist + README + package.json), nothing extra leaking in
```

Also sanity-check `sdk/runtime/package.json`'s `dependencies` — it should list `@ag-ui/core` and
`@personaai/sdk` (pinned `^0.4.0` or looser), and **must not** list itself as its own dependency
(the exact bug just fixed in `sdk/typescript/package.json` — check runtime doesn't have the same mistake).

### Pass 2 — new docs accuracy (`developer-docs/guides/runtime/*.mdx`)

For each of the 7 new pages, cross-check every concrete claim against the actual source in
`sdk/runtime/src/`:

- **`quickstart.mdx`** — `createRuntime()`'s option table (types, defaults, required/optional)
  against `sdk/runtime/src/types/options.ts`'s `CreateRuntimeOptions`. The `RuntimeRequest`/
  `RuntimeResponse` shapes against `sdk/runtime/src/types/request.ts` and `response.ts`.
- **`routes.mdx`** — every row of both tables (always-on and opt-in) against
  `sdk/runtime/src/runtime.ts`'s `buildRoutes()` and the individual `sdk/runtime/src/routes/*.ts` files.
  Check no route was added/removed/renamed since this doc was written, and that the capability
  column matches `sdk/runtime/src/types/options.ts`'s `RuntimeCapabilities`.
- **`capabilities.mdx`** — the default-off claim and the two-mount pattern against
  `sdk/runtime/src/runtime.ts`'s `resolveCapabilities()`.
- **`hooks.mdx`** — all eight hooks' signatures and context shapes against
  `sdk/runtime/src/types/hooks.ts`.
- **`reconnect.mdx`** — the `RunDriver`/eviction/heartbeat/backpressure claims against
  `sdk/runtime/src/runDriver.ts`, `sdk/runtime/src/runRegistry.ts`, and `sdk/runtime/src/heartbeat.ts`. Pay
  particular attention to the default values quoted (`runGraceMs: 300000`, `maxTrackedRuns: 1000`,
  `heartbeatIntervalMs: 15000`) — confirm they match `DEFAULT_RUN_GRACE_MS`,
  `DEFAULT_MAX_TRACKED_RUNS` in `runRegistry.ts` and the default in `options.ts`.
- **`errors.mdx`** — the error shape and two-tier trust model against `sdk/runtime/src/errors.ts`.
- **`roadmap.mdx`** — cross-links to `/guides/runtime/...` anchors (e.g.
  `#honest-limitation-single-process-in-memory-only`, `#coarse-grained-by-design`) actually match
  the heading slugs in the target pages (Mintlify slugifies headings — verify the anchor text
  matches exactly, including punctuation-to-hyphen conversion).

Also check:

- **MDX validity** — no unclosed JSX-style components (`<Warning>`, `<Note>`, `<Tip>`,
  `<AccordionGroup>`/`<Accordion>`), frontmatter (`title`/`description`) present on every page.
- **`docs.json` navigation** — valid JSON (`node -e "JSON.parse(require('fs').readFileSync('developer-docs/docs.json','utf8'))"`),
  and every path listed under the new `"Runtime Reference"` group actually resolves to a file
  (`developer-docs/guides/runtime/<name>.mdx` for each of the 7 entries).
- **Cross-links into the SDK docs** — e.g. `/guides/sdk-quickstart` — still point at real,
  existing pages (they should be unchanged, just verify nothing was mistyped).
- **Consistency with `sdk/runtime/README.md`** — the docs were adapted from the README's content but
  restructured/expanded; flag anywhere they've drifted apart in a way that suggests one is now
  wrong (not just differently worded).

## What "done" looks like

A short report per pass:

- **Pass 1**: pass/fail on each command above, and — critically — whether `sdk/runtime/package.json`
  has the self-dependency bug or not.
- **Pass 2**: a list of any factual inaccuracies found (doc says X, code does Y), any broken
  internal links/anchors, any MDX syntax issues, and any `docs.json` entries pointing at missing
  files. If genuinely nothing is wrong, say so explicitly rather than inventing minor nitpicks.

Don't fix issues yourself unless asked — this is a QA/verification pass. Flag findings clearly
enough that whoever reads the report can go straight to the fix.
