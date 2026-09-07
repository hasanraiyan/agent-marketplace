# Turn-context → RCP resolver mapping — plan

**Status: Approved** (2026-09-07) — ready to implement. The four items under "Open questions to
settle before implementation" still need explicit answers before writing code against them; they
are not yet resolved by this approval.

## Problem statement

Today an RCP tool's params are either (a) filled by the model from the conversation, or (b)
resolver-bound to the **static** per-request execution context (`domain`/`externalUserId` off
`ProjectRuntimeContext` — see `rcpSource.tools.js#buildClientFor`). There's no way to feed a param
from **per-turn, caller-supplied data** (e.g. "which notebook is open right now", "which course
page the user is on") without one of two bad options:

1. Put it in the message text and let the model extract/pass it as a normal argument — which means
   the model is now in the loop deciding a value that should be deterministic, and the conversation
   text becomes a prompt-injection surface for it ("ignore the current notebook, use notebook X").
2. Stuff it into the existing `contextOverride` string, which is appended to the **system prompt**
   — still model-visible, still not usable as a structured tool argument, and capped at 4000 chars
   of free text.

Neither lets a param stay **structurally invisible to the model** (the whole point of an RCP
resolver — see `web/app/docs/concepts/resolvers/page.tsx`) while still varying per turn instead of
being fixed at build-client time.

## Example

Not notebook-specific — any per-turn value an agent's tools need but the model shouldn't decide:
"which document is open", "current page URL", "selected row id", "active project id". The
mechanism must stay generic; the dashboard picks the key names, not this plan.

## User story

> As a Project admin configuring an RCP Source, I want to map one of its tool params to a context
> key my frontend will send with each message, so that whenever my app has that value, every agent
> using this source gets it directly and the model never sees it as a fillable argument or gets a
> chance to have it overridden via the conversation — and when my app doesn't have that value for a
> given turn, the call fails clearly for that turn rather than silently exposing the param to the
> model as a fallback.

## Design (two additions, orthogonal to today's `contextOverride`)

1. **A new structured per-turn field, `context: Record<string, unknown>`**, sent alongside
   `messages` — distinct from `contextOverride` (string → system prompt). `context` is **never**
   shown to the model in any form; it only ever feeds resolver lookups. Capped in size the same way
   `contextOverride` is (reject oversized, don't truncate).
2. **`paramContextMap` on the `RcpSource` model itself** (not per-agent — decided 2026-09-07 after
   weighing both locations, see "Where the mapping lives" below), `{param, contextKey}[]` (plain
   name-to-name pairs, since `rcp-sdk`'s own `resolvers` map is keyed purely by param name — see
   `typescript/src/client.ts`'s `CreateRcpClientOptions.resolvers`). Edited on the source's own
   Create/Edit page against its cached tool/param list; an agent's edit page only displays it
   read-only, so an admin attaching the source can see what context keys it expects.

### Where the mapping lives: RcpSource, not the Agent attachment

Considered putting `paramContextMap` on `agent.rcpSources[]` instead (a per-attachment subdocument,
letting two different agents attach the same source with two different mappings). Decided against
it: the same source is genuinely reused across agents in practice, and the simpler "one mapping,
shared by every agent attaching this source" model — living where the source's own cached
tool/param list already lives — was preferred over per-agent flexibility that wasn't needed. The
tradeoff, stated plainly: every agent attaching a given source is now forced to use that source's
one mapping; editing it from one agent's context affects every other agent attached to the same
source too.

**Corrected 2026-09-07 — caching makes "per-turn" trickier than it first looked; see below.**
`buildAgent()` caches the fully-built agent (tools included) per `(agentId, identityKey)` and
reuses it "across every turn from that caller" (`agent.factory.js:80-81`) until the Agent document
itself changes. `resolveRcpSourceTools` — where `createRcpClient({resolvers})` and `client.discover()`
run — only executes on a **cache miss**. That has two consequences:

1. **Which params are hidden from the model is a static, per-agent decision, not a per-turn one.**
   `discover()`'s `exposedParams` stripping happens once, at build time. So: if the dashboard maps
   a param via `paramContextMap`, that param is hidden from the model on **every** turn, full stop
   — never "only when this turn happens to include it." (This is also just... correct: RCP's own
   design already treats a resolver-bound param as permanently absent from the schema, never
   conditionally so — see `web/app/docs/concepts/resolvers/page.tsx`.)
2. **The resolver *function* can be built once and cached; only the *value* it returns may vary per
   turn** — and that value must flow in through the same channel `contextOverride` already uses for
   exactly this reason: LangGraph's per-invocation `configurable`, passed fresh on every
   `agentInstance.streamEvents(inputArg, { configurable: { thread_id, contextOverride, turnContext } })`
   call (`agui.service.js`), never baked into the cached graph/tool object itself — confirmed by how
   `contextOverrideMiddleware` reads `getConfig()?.configurable?.contextOverride` fresh on every
   model call "even though the graph object itself is cached" (`agent.factory.js:86-87`'s own
   comment). The RCP tool's `func` must do the same: call `getConfig()` (from `@langchain/langgraph`,
   same import `agent.factory.js` already uses) **at the moment it executes**, never close over a
   `turnContext` value captured back when `resolveRcpSourceTools` happened to build it — which could
   have been many turns ago, from a stale request.
3. **If a mapped param's `configurable.turnContext` has no value for a given turn, the tool call
   fails for that turn** (`rcp-sdk`'s own documented resolver behavior: *"a resolver with nothing to
   resolve from... fails the call before any HTTP request goes out"*) rather than falling back to
   exposing the param to the model — falling back would silently defeat the entire reason the param
   was hidden in the first place. This replaces the original "falls through to model-fillable when
   absent" idea, which turned out to be incompatible with the cache (schema shape can't flip per
   turn) as well as being the weaker security posture anyway.

Net effect on `resolveRcpSourceTools`: register `resolvers[param] = (ctx) => ctx.turn?.[contextKey]`
once, from static `paramContextMap` config (this part is cache-safe — it's just param names, no
values); `client.discover()` keeps using the static execution context, unchanged. Only the `ctx`
passed to `client.call()` — inside `func`, at actual invocation — must be assembled fresh each time
by reading `getConfig()?.configurable?.turnContext` live, never assembled once outside `func` and
closed over.

**Trust note carried over from the earlier discussion:** this bucket is for *convenience/UX*
params the model shouldn't second-guess, not a security boundary — `context` is caller-supplied
(the frontend/end-user's own request), so a value here is not protected from the caller the way
`domain`/`externalUserId` (server-verified) are. Security-sensitive params (tenant id, real user
id) must keep resolving from the existing static `ProjectRuntimeContext` path, never from this new
per-turn `context`. Worth restating in the dashboard copy so admins don't reach for this for the
wrong kind of param.

---

## Plan

### 1. Backend (`agent-backend`) — DONE 2026-09-07

`agent.model.js`/`agent.factory.js`/`agent.validator.js`/`agent.repository.js` were tried with
`paramContextMap` as a per-attachment subdocument first, then **reverted to their original bare-id
shape** — the mapping ended up living on `RcpSource` instead (see "Where the mapping lives" above),
so nothing about how an Agent references its RCP Sources changed at all.

- [x] `rcpSource.model.js` — added `paramContextMap: [{param, contextKey}]` (default `[]`) to the
      schema, shared by every agent attaching this source. Also added a `params` field to
      `toolSummarySchema` (`{name, type, description, required}[]`) — the dashboard mapping UI needs
      every tool's param names, which the display cache didn't carry at all before this.
- [x] `rcpSource.validator.js` — `paramContextMap` added to both `createRcpSourceSchema` and
      `updateRcpSourceSchema` (array of `{param, contextKey}`, both required strings).
- [x] `rcpSource.service.js` — `createRcpSource` explicitly includes `paramContextMap` in the
      persisted doc (`updateRcpSource`'s `{...data}` spread already carried it through unchanged).
      `testConnection` now maps `tool.exposedParams` (confirmed always the *full*, unfiltered list
      here, since `_buildClientFor` registers no resolvers) into the new `params` summary field.
- [x] `rcpSource.tools.js#resolveRcpSourceTools` — builds `resolvers` once per source from its
      static `paramContextMap` (param names only): `resolvers[param] = (ctx) => ctx?.turn?.[contextKey]`,
      passed to `createRcpClient({ auth, headers, resolvers, logger })` (previously no `resolvers`
      were ever passed). `client.discover(source.url, context)` **stays exactly as before** —
      confirmed from `rcp-sdk`'s own source that `exposedParams` filtering only checks
      `!(param.name in resolvers)` (a static key check, never actually calling a resolver), so
      `discover()` needs no turn data. Only `client.call(tool, agentArgs, ctx)` **inside each tool's
      `func`** — the one place a resolver is actually invoked — builds its `ctx` fresh *at call
      time*: `{ execution: context, turn: getConfig()?.configurable?.turnContext }` (`getConfig`
      imported from `@langchain/langgraph`, same as `agent.factory.js`'s
      `contextOverrideMiddleware`). `execution: context` stays closure-captured (per-identity,
      stable for the whole cache lifetime, unchanged from before); `turn` is read live on every
      call, never captured outside `func`.
- [x] `agui.service.js#runAgentAsAguiEvents` — accepts a new `turnContext` param, added to the
      `configurable` object passed to `agentInstance.streamEvents(inputArg, { configurable: {
      thread_id, contextOverride, turnContext }, ... })`, right alongside `contextOverride` (same
      per-invocation channel, same reasoning — see the caching correction above).
- [x] `agui/turnContext.js` (new) — `validateTurnContext(context)`: flat object, string/number/
      boolean values only, ≤2000 bytes serialized, throws a 400 `BaseError` on any violation.
      Wired into both `agui.controller.js` and `developerAgui.controller.js` (`input.context` →
      `turnContext`, passed to `runAgentAsAguiEvents`).
- [x] `@openapi` JSDoc blocks in both `agui.routes.js` and `developerAgui.routes.js` — documented
      the new `context` body field distinctly from `contextOverride`.
- [x] Dashboard admin API: `project.routes.js`'s existing `validateBody(createRcpSourceSchema)` /
      `validateBody(updateRcpSourceSchema)` middleware + `project.controller.js`'s pass-through of
      `req.body` to `rcpSourceService` already carries `paramContextMap` end-to-end — no route/
      controller code changes needed beyond the validator update above.
- [x] Tests: `rcpSource.tools.test.js` — new `describe('paramContextMap ...')` block covering (a) a
      mapped param stripped from the tool's zod schema while an unmapped one stays fillable, (b) the
      mapped value resolved live from a mocked `getConfig()` at call time (not from anything closed
      over at build time), (c) the call failing (never falling back to the model) when
      `configurable.turnContext` has no value for the mapped key. `rcpSource.service.test.js`
      updated for the new `params` field on tool summaries, plus a new case asserting the full
      param list (name/type/description/required) is captured correctly. All 20 pre-existing +
      3 new tests pass; 3 unrelated pre-existing failures elsewhere in the suite confirmed via
      `git stash` to predate this work entirely.

### 2. Frontend (`frontend`) — DONE 2026-09-07

- [x] RCP Source's own Create/Edit page (`app/developer/projects/[id]/rcp-sources/[sourceId]/edit/page.jsx`,
      shared by `new/page.jsx`) — a new "Context mapping" section below Discovered tools, shown once
      any tool has params. De-dupes params by *name* across every discovered tool (matches
      `rcp-sdk`'s resolver keying — one mapping per param name, not per (tool, param) pair), one row
      per unique param with a text input for its context key; emptying the input un-maps it back to
      model-fillable. `paramContextMap` added to `formData`, loaded from the source on edit, and
      included in the create/update submit body.
- [x] Agent editor's RCP source attachment UI
      (`app/developer/projects/[id]/agents/[agentId]/edit/page.jsx`) — a read-only block rendered
      under the RCP Sources `AttachmentPicker` for each currently-*selected* source that has a
      non-empty `paramContextMap`, listing every `contextKey -> param` pair and pointing the admin
      to the source's own page to change it. Not part of the shared `AttachmentPicker` component
      itself (kept RCP-specific rendering out of a component other attachment types also use).
- [x] `lib/api/projects.js` — no change needed: `createProjectRcpSource`/`updateProjectRcpSource`
      already pass `data` through generically (`api.post/patch(url, data)`, no field allowlist), so
      `paramContextMap` flows through as soon as the caller includes it.
- [x] Trust-note copy — one line under the mapping section on the source's edit page ("Caller-supplied,
      not server-verified — don't map a tenant id or real user id here...").
- Both edited files pass `eslint` clean.

### 3. `@personaai/sdk` (`sdk/typescript`) — DONE 2026-09-07

- [x] `src/types/chat.ts` — `context?: Record<string, unknown>` added to `SendMessageOptions`,
      doc comment cross-linked with `contextOverride`'s.
- [x] `src/chat/chat-client.ts` — `context` included in the POST body alongside
      `messages`/`resume`/`contextOverride`; added to both debug-log calls and the `stream()` doc
      comment.
- [x] `test/chat/chat-client.test.ts` — new case asserting `context` is forwarded verbatim and
      stays distinct from `contextOverride` in the same request.
- [x] CHANGELOG + version bump to `0.7.4`. Full suite: 121 passed, 1 skipped (live integration
      test, unrelated), build clean.

### 4. `@personaai/runtime` (`sdk/runtime`) — DONE 2026-09-07

- [x] `src/routes/chat.ts` — `ChatBody` + `parseChatBody` gain `context`, validated by the shared
      `validateTurnContext` helper (added in the voice extension above — reused here rather than
      duplicated), forwarded to `ctx.client.chat.stream(body.agentId, { ..., context: body.context
      })`.
- [x] `logger.trace('chatRoute body', {...})` — `hasContext: !!body.context` added alongside the
      existing `hasContextOverride`.
- [x] `test/chat.test.ts` — new cases: `context` forwarded to the underlying fetch body alongside
      (and distinct from) `contextOverride`; a non-object `context` rejected with 400, no API call.
      Verified end to end (typecheck + all 12 chat tests + full 170-test suite) via a temporary
      local-build overlay of `@personaai/sdk`'s pnpm store entry, since `0.7.4` isn't published yet
      — restored the real installed `0.7.2` afterward; `npm run build` succeeds regardless (tsup's
      bundler/DTS step doesn't fail on this particular type gap the way `tsc --noEmit` does).
- [ ] Bump `@personaai/runtime`'s dependency on `@personaai/sdk` to `^0.7.4` — blocked on that
      version being published first (same gate every dependency bump in this plan has used).
- [x] CHANGELOG + version bump to `0.9.3`.

### 5. `@personaai/react` (`sdk/react`) — DONE 2026-09-07

(The pre-existing `contextOverride`-not-forwarded gap this section originally flagged was already
fixed earlier as its own small patch, in `0.7.5` — unrelated to this feature, done before it.)

- [x] `src/types.ts` — `UseChatOptions.context` (`Record<string, unknown> | (() =>
      Record<string, unknown>)`) and `SendMessageOverride.context` (`Record<string, unknown>`,
      call-level only) added, both cross-linked in their doc comments.
- [x] `src/hooks/useChat.ts#sendMessage` — resolves the hook-level `context` at send-time (calls it
      if it's a function), shallow-merges `overrideOptions?.context` on top (override wins on key
      collisions), and omits the `context` body field entirely when the merged result is empty
      rather than sending `context: {}` every turn.
- [x] No dedicated test added — this package has no existing `useChat` unit test file at all (only
      `test/streaming.test.mjs`), same gap already noted for the earlier `contextOverride` fix;
      `npm run typecheck` is clean.
- [x] CHANGELOG + version bump to `0.7.8`, build clean. Doesn't pin `@personaai/runtime`/
      `@personaai/sdk` directly (talks to them over plain HTTP, no package dependency).

### 6. Adapters (`sdk/adapters/express`, `sdk/adapters/nestjs`, `sdk/adapters/nextjs`) — blocked on publish

- [x] No code changes needed — confirmed (again) each adapter's `translate.ts` passes
      `request.body` through as untyped JSON straight to the runtime's route table; `context`
      needs no adapter-side parsing, same as every other body field bump in this plan.
- [x] `nextjs/src/server.ts`'s re-exported type list — checked, `context` doesn't need adding:
      it's a plain field on existing exported option types (`SendMessageOptions`,
      `CreateVoiceSessionOptions`), not a new type of its own like `RcpManifestOptions` was.
- [ ] Bump each adapter's `@personaai/sdk` dep to `^0.7.4` and `@personaai/runtime` dep to
      `^0.9.3`, `pnpm install`, re-run each adapter's test suite + build — **blocked until you
      publish `@personaai/sdk@0.7.4` and `@personaai/runtime@0.9.3`** (same "verify against the
      real published package" gate every other bump in this plan used; a temporary local-build
      overlay already confirmed the underlying code is correct, so this step is pure mechanics
      once those two are live).

## Publish queue (in this order — later ones depend on earlier ones)

1. `@personaai/sdk@0.7.4` (text `context`) — also carries `0.7.3`'s voice `context` if not
   already published.
2. `@personaai/runtime@0.9.3` (needs sdk `0.7.4`) — also carries `0.9.2`'s voice `context` if not
   already published.
3. `@personaai/react@0.7.8` (independent of the above two — talks HTTP, not a package dependency;
   can publish any time, but its CHANGELOG says it "requires" 1-2 for the feature to actually work
   end to end) — also carries `0.7.7`'s voice `context`/`updateContext` if not already published.
4. `sdk/adapters/{express,nestjs,nextjs}` — after bumping their deps to the versions from 1-2 and
   re-verifying (step 6 above).

---

## Decisions (settled 2026-09-07)

- **Merged resolver `ctx` shape** (backend step 1) — **namespaced, never flattened**:
  `{ execution: executionContext, turn: turnContext }`. A flat `{...executionContext,
  ...turnContext}` merge would let caller-supplied `turnContext` silently clobber a same-named
  `domain`/`externalUserId` key — the exact trust-mixing problem this feature has to avoid. Every
  resolver states explicitly which bucket it trusts: `(ctx) => ctx.execution.externalUserId` vs.
  `(ctx) => ctx.turn.courseId`. Free to pick — no resolver exists in the codebase yet, so nothing to
  migrate.
- **Context size cap** — its own limit, not `contextOverride`'s 4000-char prose cap: `context` must
  be a **flat object of string/number/boolean values only** (no nested objects/arrays), ≤2000 bytes
  serialized, **reject** (not truncate) on violation. It holds identifiers, not prose, and banning
  nesting closes off using it to smuggle a large payload past the cap.
- **Default key-matching** — **no auto-match; every mapping must be explicit** in the dashboard,
  even when a tool param's name happens to match a sent `context` key. Matches RCP's own resolver
  philosophy verbatim (`web/app/docs/concepts/resolvers/page.tsx`): *"a client that never
  configures a resolver for a given param just shows it to the model as an ordinary fillable
  argument — there's no protocol-level signal warning otherwise."* Auto-matching would make that
  signal silently implicit and could change a tool's behavior the moment a host app's `context`
  payload evolves, with no dashboard change to explain why.
- **`useChat` API shape** (react step 5) — **support both, hook-level as the primary path**:

  ```ts
  useChat({ context: () => ({ courseId: currentCourseId }) }) // getter, or a plain object
  sendMessage(text, { context: { courseId: "205" } })          // call-level override
  ```

  At send-time: resolve the hook-level value (call it if it's a function, so it always reads the
  host app's *current* state without a ref or an effect syncing one), then shallow-merge any
  call-level `overrideOptions.context` on top (`{ ...resolvedHookContext, ...overrideOptions.context
  }`). Mirrors the existing `agentId`/`resume`/`threadId` hook-default + call-override pattern in
  `SendMessageOverride`.

## Voice extension (added 2026-09-07) — DONE

Not in the original scope: RCP tools are shared verbatim between text and voice
(`resolveVoiceTools` → `resolveAgentTools` → `resolveRcpSourceTools`, same tool objects), but
voice's tool invocation (`VoiceSession.js`'s `tool.invoke(fc.args, { signal })`) never went through
`agentInstance.streamEvents()`, so a mapped param's resolver always had `configurable` empty —
**any RCP tool with a `paramContextMap` entry hard-failed on every voice call**, unconditionally.

Two options considered for the fix:

- **A — context fixed at `start()`, mirrors `contextOverride`'s voice behavior exactly.** Simple,
  reuses the exact plumbing just built for `contextOverride`, but the *only* way to refresh it is
  `stop()` + `start()` a new session — hanging up and redialing, audio cut, new Gemini Live session.
- **B — same at-connect seed, plus a live `voice.context` WS message to refresh mid-call with no
  reconnect.** Chosen: a voice call runs up to 15 minutes, long enough for the caller's own context
  to change, and forcing a hangup just to refresh a value is bad UX for exactly the case ("user
  navigated") this whole feature exists to handle.

Implementation (Option B):

- [x] `VoiceSession.js` — `this.turnContext` (seeded from constructor's `initialContext`), a new
      `voice.context` case in `_handleClientMessage` (validates via `agui/turnContext.js`'s shared
      `validateTurnContext`, merges rather than replaces, logs+ignores on invalid rather than
      tearing down the session), and `tool.invoke(fc.args ?? {}, { signal, configurable: {
      turnContext: this.turnContext } })` — read fresh at the moment each tool call actually
      executes, same live-read contract as text chat's `getConfig()`.
- [x] `developerVoice.controller.js` / `projectAgentVoiceTest.controller.js` — accept `context` in
      the request body (same `validateTurnContext` helper), carried in the signed ticket claims
      alongside `contextOverride`.
- [x] `voiceGateway.js` — passes `claims.context` as `VoiceSession`'s `initialContext`.
- [x] `@personaai/sdk` (`0.7.3`) — `CreateVoiceSessionOptions.context`, sent in `createSession()`'s
      JSON body alongside `contextOverride`.
- [x] `@personaai/runtime` (`0.9.2`) — new shared `validateTurnContext` in `routeHelpers.ts` (uses
      `TextEncoder`, not `Buffer` — this package must stay Edge-runtime compatible), wired into the
      `/voice/sessions` route. Will be reused by the text `chat` route (step 4 below) instead of
      duplicating the validation logic.
- [x] `@personaai/react` (`0.7.7`) — `useVoice({ context })` for the seed, plus a new
      `updateContext(context)` return value that sends `{ type: 'voice.context', context }` over
      the already-open WebSocket.
- Adapters — no code changes expected (same generic-passthrough reasoning as `contextOverride`);
  version bumps pending once `@personaai/sdk@0.7.3` is published (the same "verify against the real
  published package" gate every other bump in this plan has used).

## What stays exactly as-is

- `contextOverride` (string → system prompt) — completely unrelated mechanism, untouched.
- The existing static-context resolver path (`domain`/`externalUserId` via
  `ProjectRuntimeContext`) for security-sensitive params — this feature adds a second,
  caller-supplied bucket, it doesn't replace or weaken the first.
- REST Tool Sources / REST API Tools — no interaction with this feature.
