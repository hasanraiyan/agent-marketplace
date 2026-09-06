# Deprecate REST Tool Sources (the "tool grouping" feature) — plan

## What this is and isn't

**Removing:** REST Tool Sources — the feature where you register a hosted manifest URL and
Persona discovers *many* tools from it live (the "tool group" / "sources" pattern). RCP Sources
now covers this exact use case, as an open protocol instead of a Persona-specific one.

**Not removing, not touching:** REST API Tools — the single, manually-created tool built in
Studio's form (Path/Params/Headers/Auth/Body tabs). That's a completely separate feature with no
relationship to "grouping." Nothing about it changes in any phase below.

**Why now:** RCP Sources is live, tested, and working end-to-end (Coursify's `get_learner_profile`
call confirmed the full pipeline). It does everything REST Tool Sources did, in an open protocol
other platforms could also adopt, with simpler identity handling (a header, not a template token).

## The hard constraint: this cannot be an immediate deletion

**Skillify and Coursify are live, active clients already using REST Tool Sources today** — that's
what `NEXTJS_REST_TOOL_SOURCES_GUIDE.md` and `SKILLIFY_FIX_REQUIRED.md` walked them through.
Deleting the backend module, routes, or SDK exports before they've migrated would silently break
their production Agents — their attached sources would stop resolving tools with no warning.

This has to be three phases, in order, each gated on the one before it:

1. **Announce + soft-deprecate** — mark deprecated everywhere it's visible, ship migration guides,
   change nothing functionally yet.
2. **Confirm migration** — verify Skillify and Coursify have actually moved to RCP Sources and
   REST Tool Sources shows zero active usage from them.
3. **Remove** — only after step 2, delete the code, routes, UI, and SDK surface.

Do not start Phase 3 work until Phase 2 is confirmed, even if this plan is fully written out below.

---

## Phase 1 — Announce + soft-deprecate (safe to do now)

- [ ] Write/send a migration guide to Skillify, mirroring `COURSIFY_RCP_GUIDE.md` — what to change,
  step by step, framed as "please migrate by \[date\]," not "here's a new option you might like."
  (Coursify already has a guide; update it to say REST Tool Sources is deprecated, not just "here's
  something new.")
- [ ] Add a visible deprecation notice in Studio's **Tool Sources** tab (banner or badge: "REST
  Tool Sources is deprecated — use RCP Sources instead") — UI copy only, the feature still works.
- [ ] Add a deprecation note to the top of `developer-docs/guides/rest-tools.mdx`'s "Code-first:
  REST Tool Sources" section, pointing to `/guides/rcp`.
- [ ] Add a deprecation note to the top of `developer-docs/guides/sdk/resources/rest-tools.mdx`
  (the `defineRestTool()` reference).
- [ ] Add a deprecation note to `developer-docs/guides/runtime/routes.mdx`'s "Static manifest
  route" section (the `restToolsManifest` docs).
- [ ] Mark `defineRestTool()` and `restToolsManifest`/`RestToolsManifestOptions` as `@deprecated`
  in their JSDoc (TypeScript surfaces the strikethrough in editors) — no behavior change, just a
  visible signal to anyone about to adopt it fresh.
- [ ] Decide and communicate an actual removal date (e.g. "REST Tool Sources stops working on
  \[date\], N weeks out") — put it in the deprecation notices above, not just in this plan.

## Phase 2 — Confirm migration (gate before touching any code)

- [ ] Confirm Skillify's Agent(s) have `rcpSources` populated and `restApiToolSources` empty (or
  ask them directly).
- [ ] Confirm Coursify's Agent(s) likewise.
- [ ] Check `agent-backend` logs / usage data for any `[RestApiToolSource]` log lines in the weeks
  after the announced date — zero real traffic is the actual signal to proceed, not just "we sent
  the email."
- [ ] Check for any *other* Project using REST Tool Sources beyond these two clients (query
  `RestApiToolSource` documents / `Agent.restApiToolSources` non-empty arrays) — reach out to
  anyone else found before proceeding.

## Phase 3 — Remove (only after Phase 2 is confirmed clean)

### Backend (`agent-backend`)

- [ ] Delete `src/modules/restApiToolSources/` (model, service, repository, validator, tools.js)
      in full.
- [ ] Delete `src/modules/developer/developerRestApiToolSource.controller.js` and `.routes.js`.
- [ ] Remove the re-exports from `src/modules/developer/index.js`
      (`developerRestApiToolSourceRouter`/`Controller`).
- [ ] Remove the mount line in `src/index.js`
      (`app.use('/api/v1/developer/rest-tool-sources', ...)`).
- [ ] `agent.model.js` — remove the `restApiToolSources` field.
- [ ] `agent.factory.js` — remove `'restApiToolSources'` from the `populate([...])` array.
- [ ] `agent.validator.js` — remove `restApiToolSources` from both create/update schemas.
- [ ] `agent.repository.js` — remove `findAgentsUsingRestApiToolSource` /
      `removeRestApiToolSourceFromAgents`.
- [ ] `tools/index.js` — remove the REST Tool Sources step and its import.
- [ ] `project.controller.js` / `project.routes.js` — remove the whole REST Tool Sources
      `adminRouter` block (list/create/update/delete/usage/bulk-delete/test).
- [ ] **Data cleanup**: before/alongside deploying this, run a one-time migration to `$unset:
      { restApiToolSources: 1 }` on every `Agent` document, then drop the `RestApiToolSource`
      collection. Do this as an explicit, reviewed migration script — never an ad-hoc `dropCollection`
      call.
- [ ] Remove `agent-backend`'s tests for this module
      (`tests/restApiToolSource.service.test.js`, `tests/restApiToolSource.tools.test.js`,
      any related fixtures in `projectController.test.js`/`projectRoutes.integration.test.js`).

### Frontend (`frontend`)

- [ ] Remove the **Tool Sources** tab and its `NAV_SECTIONS` entry from
      `app/developer/projects/[id]/page.jsx`, and every piece of state/effect/handler/dialog wired
      to it (mirror the RCP Sources additions from the RCP build, in reverse).
- [ ] Delete `app/developer/projects/[id]/rest-tool-sources/` (both `new/` and `[sourceId]/edit/`).
- [ ] Remove the REST Tool Sources attachment picker from the Agent editor page.
- [ ] Remove the `*ProjectRestToolSource*` functions from `lib/api/projects.js`.
- [ ] Remove the `projectRestToolSource*` helpers from `lib/developer-routes.js`.

### SDK (`sdk/typescript`, `sdk/runtime`, adapters)

- [ ] Remove `defineRestTool()` and the `@personaai/sdk/rest-tools` entry point entirely (or leave
      a stub that throws a clear "removed, use `rcp-sdk/server`'s `defineTool()`" error for one
      more release before deleting outright — softer landing for anyone who missed the deprecation
      notice).
- [ ] Remove `restToolsManifest`/`RestToolsManifestOptions`/`RestToolManifestEntry` from
      `sdk/runtime` (`types/options.ts`, `routes/restToolsManifest.ts`, `runtime.ts`, `index.ts`).
- [ ] Remove the corresponding re-exports from `sdk/adapters/nextjs/src/server.ts`.
- [ ] Remove `persona.restTools`'s *source*-related surface if any exists distinct from the plain
      REST API Tool CRUD (check `sdk/typescript/src/resources/restTools.ts` — keep plain
      create/list/get/update/delete/test, remove nothing there since that's REST API Tools, not
      Sources).
- [ ] Version bumps: this is a **breaking change** for `@personaai/sdk` and `@personaai/runtime` —
      major or minor-with-clear-breaking-note per whatever this repo's semver discipline is: check
      before bumping, don't just patch-bump a removal.

### Docs (`developer-docs`)

- [ ] Remove the "Code-first: REST Tool Sources" section from `guides/rest-tools.mdx` (keep the
      "Manual: building a tool in Studio" section — that's REST API Tools, staying).
- [ ] Remove `guides/sdk/resources/rest-tools.mdx`'s `defineRestTool()` reference (keep the plain
      CRUD reference for `persona.restTools`).
- [ ] Remove the "Static manifest route" section from `guides/runtime/routes.mdx` (keep the new
      "RCP manifest route" section).
- [ ] Remove the REST Tool Sources row from `integration-guide.mdx`'s table (keep the RCP Sources
      row and the REST API Tools row).
- [ ] Leave `NEXTJS_REST_TOOL_SOURCES_GUIDE.md` and `SKILLIFY_FIX_REQUIRED.md` as historical
      artifacts (don't delete — they're dated records of what was communicated to a client at the
      time) but consider adding a one-line "superseded by RCP, see COURSIFY_RCP_GUIDE.md" note at
      the top of each.

## Explicit checklist of what stays exactly as-is (do not touch in any phase)

- `agent-backend/src/modules/restApiTools/` (the whole module — model, service, tools.js,
  validator, repository, controller, routes) — this is REST API Tools, unrelated to Sources.
- `agent-backend/src/modules/projects/projectSecret.service.js` and the Secrets tab — shared by
  REST API Tools, RCP Sources, and (until Phase 3) REST Tool Sources; nothing about it is
  Sources-specific.
- `sdk/typescript/src/resources/restTools.ts`'s plain CRUD (`create`/`list`/`get`/`update`/
  `delete`/`test`) — that's the REST API Tools resource, not the Sources feature.
- Everything RCP-related that was just built (`rcpSources/`, `rcp-sdk`, `rcpManifest`, the Studio
  RCP Sources tab) — obviously.
