# Remove REST Tool Sources (the "tool grouping" feature) — plan

## What this is and isn't

**Removing:** REST Tool Sources — the feature where you register a hosted manifest URL and
Persona discovers *many* tools from it live (the "tool group" / "sources" pattern). RCP Sources
now covers this exact use case, as an open protocol instead of a Persona-specific one.

**Not removing, not touching:** REST API Tools — the single, manually-created tool built in
Studio's form (Path/Params/Headers/Auth/Body tabs). That's a completely separate feature with no
relationship to "grouping." Nothing about it changes anywhere below.

**Why now, and why directly:** RCP Sources is live, tested, and working end-to-end (Coursify's
`get_learner_profile` call confirmed the full pipeline). REST Tool Sources itself was always a
beta feature — no formal deprecation window is needed. Skillify and Coursify already have RCP
migration guides; remove the old feature directly rather than running a staged
announce/confirm/remove rollout.

---

## Removal checklist

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
- [ ] **Data cleanup**: run a one-time migration to `$unset: { restApiToolSources: 1 }` on every
      `Agent` document, then drop the `RestApiToolSource` collection. Do this as an explicit,
      reviewed migration script — never an ad-hoc `dropCollection` call.
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

- [ ] Remove `defineRestTool()` and the `@personaai/sdk/rest-tools` entry point entirely.
- [ ] Remove `restToolsManifest`/`RestToolsManifestOptions`/`RestToolManifestEntry` from
      `sdk/runtime` (`types/options.ts`, `routes/restToolsManifest.ts`, `runtime.ts`, `index.ts`).
- [ ] Remove the corresponding re-exports from `sdk/adapters/nextjs/src/server.ts`.
- [ ] Leave `persona.restTools`'s plain CRUD alone (`sdk/typescript/src/resources/restTools.ts`'s
      `create`/`list`/`get`/`update`/`delete`/`test`) — that's REST API Tools, not Sources.
- [ ] Version bumps: this removes public SDK surface — bump `@personaai/sdk` and
      `@personaai/runtime` as a breaking change (major, or whatever this repo's convention is for a
      removal), not a patch bump. Note it clearly in each CHANGELOG.

### Docs (`developer-docs`)

- [ ] Remove the "Code-first: REST Tool Sources" section from `guides/rest-tools.mdx` (keep the
      "Manual: building a tool in Studio" section — that's REST API Tools, staying).
- [ ] Remove `guides/sdk/resources/rest-tools.mdx`'s `defineRestTool()` reference (keep the plain
      CRUD reference for `persona.restTools`).
- [ ] Remove the "Static manifest route" section from `guides/runtime/routes.mdx` (keep the
      "RCP manifest route" section).
- [ ] Remove the REST Tool Sources row from `integration-guide.mdx`'s table (keep the RCP Sources
      row and the REST API Tools row).

## Explicit checklist of what stays exactly as-is

- `agent-backend/src/modules/restApiTools/` (the whole module — model, service, tools.js,
  validator, repository, controller, routes) — this is REST API Tools, unrelated to Sources.
- `agent-backend/src/modules/projects/projectSecret.service.js` and the Secrets tab — shared by
  REST API Tools and RCP Sources; nothing about it is Sources-specific.
- `sdk/typescript/src/resources/restTools.ts`'s plain CRUD — that's the REST API Tools resource,
  not the Sources feature.
- Everything RCP-related that was just built (`rcpSources/`, `rcp-sdk`, `rcpManifest`, the Studio
  RCP Sources tab) — obviously.

## One real consequence, stated plainly

Any Agent still attached to a REST Tool Source loses those tools the moment this ships — there is
no grace window. Skillify and Coursify are the two known users of this feature; both already have
RCP migration guides. Worth a heads-up message to them at ship time even though this plan doesn't
gate removal on it.
