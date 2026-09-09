# Agent Sandbox (CodeSandbox) — enable real code execution

## Context

Agents currently only get a *virtual* filesystem: `agent.factory.js` builds each
agent's `backend` as `new CompositeBackend(new VersionedStateBackend(), backendRoutes)`,
where every route (`/memories/`, `/skills/`, `/stores/`, `/skill-library/`) is a
`StoreBackend` over MongoDB. There is no real shell — a comment already marks the
intended extension point:

```js
// agent.factory.js:802
// sandbox backend if real code execution is ever required.
backend,
```

The goal is to turn that comment into a real feature: give agents an actual
isolated VM (via CodeSandbox) to run shell/code in.

**Correction from the first draft (per Raiyan):** the CodeSandbox API key does
NOT belong in `agent-backend/.env`. Each Project already has its own secret
store (`ProjectSecret` — the same thing backing the REST API Tool Builder's
Auth tab), and users add secrets there per-project through the product UI. The
sandbox key should be sourced the same way: a `ProjectSecret` labeled
`CSB_API_KEY` on the Project the agent belongs to. If a user tries to turn
`sandboxEnabled` on for an agent and that Project has no `CSB_API_KEY` secret
yet, tell them to add it first (in the Project's Secrets UI) instead of
silently failing — no global `.env` key at all.

## Verified building blocks

- `deepagents@1.11.1` (already a dependency) publicly exports `BaseSandbox` — a
  class whose **only abstract method is `execute(command)`**; it derives `ls`,
  `read`, `grep`, `glob`, etc. from it. Confirmed in
  `node_modules/deepagents/dist/index.d.ts` and the bundled source
  (`langsmith-DVh4u6Za.js`), where `LangSmithSandbox extends BaseSandbox` is the
  shipped reference implementation (implements `execute`, `uploadFiles`,
  `downloadFiles`, `id`, `start`/`stop`/`close`).
- A backend is treated as sandbox-capable by `isSandboxBackend()` iff it has a
  string `id` and a function `execute` — that's the whole contract we must
  satisfy for `CodeSandboxBackend`.
- `resolveAgentTools` (`src/modules/tools/index.js`) already has the exact
  gating pattern to copy: `getSearchTool()` in `search.tool.js` returns `null`
  when `TAVILY_API_KEY` is missing and logs a warning instead of throwing.
- `agent.model.js` already has a boolean per-agent toggle for an optional
  capability (`webSearchEnabled`) — `sandboxEnabled` should follow the same
  shape.
- `buildAgent()` caches the compiled instance (and therefore the `backend`) per
  `effectiveCacheKey = ${cacheKey}:${identityKey}` — i.e. **per (agent, user)**,
  not per message and not per thread — and invalidates automatically whenever
  `agent.updatedAt` changes (so flipping `sandboxEnabled` naturally triggers a
  rebuild). This means one CodeSandbox VM per (user, agent) is the right reuse
  granularity — matches how `/memories/user/` and `/stores/` are already scoped
  — not a new VM per chat turn.
- `projects/projectSecret.model.js` + `projectSecret.service.js` are the
  existing per-Project secret store: `label` + reversibly-encrypted `value`,
  unique per `(project, label)`, decrypted on demand via
  `encryption.decrypt()`. Today it's only referenced by `secretRef` (an
  ObjectId) from RestApiTool docs; the sandbox key will instead be looked up
  **by the well-known label `CSB_API_KEY`** within the agent's Project, since
  there's no per-agent "which secret" picker needed for a single fixed key.
  `projectSecret.repository.js` doesn't have a by-label lookup yet — needs a
  small addition.
- The agent's `executionContext.domain` (already threaded into
  `resolveAgentTools`/`buildAgent`) is the Project id — the same field
  `projectSecretRepository.findByProject(context.domain)` already keys on
  elsewhere — so sandbox provisioning has everything it needs without a new
  parameter.
- The Playground (`platform/src/app/projects/[projectId]/playground/page.tsx`)
  already renders Project-owned agents via `getProjectAgents(projectId)`, and
  already has the exact UI pattern to copy for a new panel: a `Button` near
  line 150 flips `memoryOpen` state, and `<MemoryWorkspaceDialog open=... />`
  (~line 257) is the dialog it opens. A "Terminal" button follows the same
  shape.
- The frontend already streams every tool call (`chat.toolCalls`, typed as
  `ChatToolCall[]` in `components/chat/types.ts`) into `ToolCallTrace` /
  `ToolCallCard`. The sandbox's shell tool is literally named `"execute"`
  (confirmed in the deepagents bundle — `name: "execute"`, with `args.command`
  in and `{ output, exitCode }` out), so a terminal transcript is just a filter
  over the same stream already reaching the chat UI — no new backend endpoint
  or streaming channel required for the read-only view.

## Implementation

1. **Dependency**
   - Add `@codesandbox/sdk` to `agent-backend/package.json`.
   - No `.env` / `config/index.js` changes for the API key — see next step.

2. **Secret sourcing: `ProjectSecret`, not `.env`**
   - `projectSecret.repository.js`: add
     `findByProjectAndLabel(projectId, label)` →
     `ProjectSecret.findOne({ project: projectId, label })` (the schema
     already has a unique `(project, label)` index, so this is a direct hit).
   - `projectSecret.service.js`: add a small internal helper (same
     "never exposed via a controller" style as `resolvePlaintext(secretId)`)
     that resolves `CSB_API_KEY` for a given `domain`: look up by label, and
     if found, decrypt and return the plaintext; if not found, return `null`
     (never throw — callers decide what "missing" means).
   - **Enable-time guard**: wherever `sandboxEnabled` gets flipped to `true`
     (agent create/update in `agent.service.js` / `agent.controller.js`),
     check that a `CSB_API_KEY` ProjectSecret exists for `context.domain`
     first; if not, reject with a `ValidationError` like *"Add a Project
     Secret named CSB_API_KEY before enabling the sandbox"* — mirrors the
     existing `"No provider configured..."` guard in `agent.factory.js` for
     the Architect. This is the primary place users hit the message, before
     they ever get to a chat.
   - **Runtime guard (defense in depth)**: `sandbox.service.js` re-checks at
     `buildAgent()` time too (the secret could be deleted after the agent was
     enabled) — if missing, log a warning and fall back to
     `VersionedStateBackend()` rather than throwing, same fail-open shape the
     rest of this plan already uses for a CodeSandbox outage.

3. **New module** `agent-backend/src/modules/sandbox/`
   - `codesandbox.backend.js`: `export class CodeSandboxBackend extends BaseSandbox`
     (import `BaseSandbox` from `deepagents`), backed by `@codesandbox/sdk`'s
     `CodeSandbox` client:
     - `execute(command)` → run the command in the sandbox's session, return
       `{ output, exitCode }`.
     - `uploadFiles([[path, content]])` / `downloadFiles([path])` → the SDK's
       filesystem read/write calls.
     - `id` getter → the CodeSandbox sandbox id.
     - No secrets are ever written into the sandbox's environment — only the
       `CSB_API_KEY` (now resolved from the Project's `ProjectSecret`, not an
       env var) is used to talk to CodeSandbox's control API from our backend,
       per the security guidance in deepagents' own sandbox docs (never inject
       app secrets into the VM the LLM can shell into).
   - `sandbox.service.js`: `getSandboxBackend({ agentId, userId, domain })` —
     - Resolves `CSB_API_KEY` via the `projectSecret.service.js` helper above,
       scoped to `domain` (the agent's Project). Returns `null` immediately if
       missing, logging a warning once (mirrors `getSearchTool()`'s
       `TAVILY_API_KEY` check).
     - Otherwise resumes-or-creates a CodeSandbox VM keyed by a deterministic
       id derived from `${agentId}:${userId}` (same granularity as
       `effectiveCacheKey`), wraps it in `CodeSandboxBackend`, and returns it.
     - Any provisioning error is caught and logged; returns `null` rather than
       throwing, so a CodeSandbox outage degrades an agent back to its normal
       virtual filesystem instead of breaking the chat.

4. **Agent model + validator**
   - `agent.model.js`: add `sandboxEnabled: { type: Boolean, default: false }`
     next to `webSearchEnabled`.
   - `agent.validator.js`: allow `sandboxEnabled` in the same place
     `webSearchEnabled` is validated.

5. **Wire it into `agent.factory.js`** (around line 792, where `backend` is
   built):

   ```js
   const sandboxBackend = agent.sandboxEnabled
     ? await getSandboxBackend({ agentId: agentIdStr, userId, domain: executionContext.domain })
     : null;
   const rootBackend = sandboxBackend || new VersionedStateBackend();
   const backend = new CompositeBackend(rootBackend, backendRoutes);
   ```

   Everything else — `backendRoutes` for `/skills/`, `/memories/`, `/stores/`,
   `/skill-library/` — is untouched, since those are independent mounted
   routes on the same `CompositeBackend` regardless of what the root backend
   is. This is also why swapping the root is safe: only the agent's top-level
   `/workspace`-style file/shell access becomes real; the DB-backed per-user
   mounts keep working exactly as they do today.
   - Update the existing comment at line 802 to point at the new module
     instead of describing it as hypothetical.

6. **Cleanup hook (best-effort only)** — in `AgentFactory.invalidate()`, if the
   evicted cache entry's backend is a `CodeSandboxBackend`, call its `close()`/
   `stop()` best-effort (don't await/block on it, don't throw). This is a nice-
   to-have, not the primary cleanup mechanism — rely on CodeSandbox's own
   idle/hibernate TTL as the real safety net, since the in-memory `agentCache`
   has no TTL sweep of its own today.

## Playground: read-only Terminal panel

A "Terminal" button next to the existing Memory button in the Project
Playground, showing a live transcript of what the sandbox is actually doing —
copies `MemoryWorkspaceDialog`'s dialog pattern, but needs **no new backend
endpoint**: the sandbox's shell tool is literally named `"execute"` (confirmed
in the deepagents bundle), so its calls already stream to the frontend through
the same AG-UI tool-call events every other tool uses.

1. **`platform/src/app/projects/[projectId]/playground/page.tsx`**: add a
   `terminalOpen` state + `Button` right next to the `memoryOpen` one (~line
   150), enabled only when `selectedAgent.sandboxEnabled` is true (needs that
   field added to the Agent type returned by `getProjectAgents` in
   `lib/api/projects.ts`).
2. **New `platform/src/components/playground/sandbox-terminal-dialog.tsx`**
   (modeled on `memory-workspace-dialog.tsx`'s `Dialog`/`DialogContent`
   shell): takes the same `chat.toolCalls: ChatToolCall[]` the running
   `AgentChat` already has, filters to `tc.name === "execute"`, and renders
   each as a `$ {args.command}` prompt line followed by its
   `{ output, exitCode }` result in a monospace, dark, auto-scrolling terminal
   box — a pure derived view, no polling, no fetch.
3. Reuse the existing `ChatToolCall` type from `components/chat/types.ts`
   rather than inventing a parallel one.

### Explicit follow-up — NOT built in this pass

A real **interactive** terminal (a human typing commands directly into the
live CodeSandbox VM, the way CodeSandbox's own web IDE terminal works) is a
separate, larger project: it needs a new backend endpoint to mint a scoped
CodeSandbox browser/session token, `xterm.js` in the frontend, and — before
any of that — a real decision on whether a human should be able to type into
the *same* VM the agent uses (mixing human and agent input in one shell) or
get an isolated view/session instead. Revisit as its own plan once the
read-only panel above has shipped and proven the sandbox backend itself works.

## Explicitly out of scope for this pass

- No frontend "Enable Sandbox" toggle in `platform/` — `sandboxEnabled` will be
  settable the same way any other agent field is today (agent update API /
  direct doc edit) until the UI catches up. Flag this as a fast follow, don't
  build it now.
- No SDK (`sdk/typescript`, `sdk/python`) or OpenAPI schema changes.
- No custom sandbox templates/images, no long-running background jobs, no
  network-egress restrictions beyond CodeSandbox's own defaults — first pass is
  "agent can run shell commands in an isolated VM," not a hardened data-exfil
  boundary.
- No interactive terminal (see follow-up above).

## Verification

1. Set `CSB_API_KEY` in `agent-backend/.env`; run `pnpm install` to pull
   `@codesandbox/sdk`.
2. Flip `sandboxEnabled: true` on one test Agent (API or direct doc edit).
3. Start a chat with that agent and ask it to run a real shell command (e.g.
   "run `python3 --version` and `echo hello` and tell me the output"); confirm
   the `execute` tool actually fires and real command output streams back
   through AG-UI.
4. Confirm the same agent can still read/write `/memories/` and `/skills/` in
   the same conversation (proves the CompositeBackend route mounts are
   unaffected by the root swap).
5. Unset `CSB_API_KEY` (or leave `sandboxEnabled: false` on another agent) and
   confirm the agent still builds and chats normally with the old
   `VersionedStateBackend` — no crash, no regression for every agent that isn't
   opted in.
