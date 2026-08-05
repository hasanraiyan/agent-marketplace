# Agent Marketplace Platform — Requirements from OnlyFounders

**From:** OnlyFounders engineering (consumer of `@personaai/sdk` /
agent-marketplace Developer Platform)
**To:** Agent Marketplace platform team
**Purpose:** OnlyFounders wants to delegate agent execution (chat, MCP,
threads, files) to the Developer Platform instead of maintaining our own
LangGraph/deepagents runtime. We've read the SDK source
(`sdk/src/*.ts`) and the backend implementation
(`agent-backend/src/modules/**`) to ground this in what actually exists
today, not the docs site. Every requirement below is expressed as a
concrete API — method, path, request body, response body — so it can be
picked up and implemented directly, not just as a prose wish.

**Note on tool execution:** an earlier draft of this doc asked for a
lighter-weight remote-tool-execution primitive as an alternative to MCP.
We're dropping that ask — your existing MCP infrastructure already does the
job. We'll stand up a thin MCP server of our own wrapping our domain tools
(`create_issues`, `search_funding_resources`, `get_founder_profile`,
`send_inbox_message`, `find_agents`) and register it the standard way. No
platform work needed on your side for tool execution itself.

Companion doc (internal, not needed to act on this): our own comparison
research at `docs/persona-sdk-migration-research.md` — this file is the
distilled "please build this" version of that research, addressed to you.

---

## How to read this

Each requirement is independently shippable. Priority reflects what blocks
our migration roadmap, not general importance:

- **P0** — blocks us from even running a single pilot agent on your platform.
- **P1** — blocks us from moving our primary agent (Maya, our main chat
  persona) to your platform in production.
- **P2** — needed for a full migration eventually, not for the pilot.

| ID | Title | Priority | API surface touched |
|---|---|---|---|
| [REQ-1](#req-1-versioned-ag-ui-custom-event-contract) | Versioned AG-UI custom event contract | P0 | New: `GET /api/v1/developer/agui/schema` |
| [REQ-2](#req-2-pre-turn-dynamic-context-hook) | Pre-turn dynamic context hook | P0 | Extends `chat.stream()` request + new `contextWebhookUrl` agent field |
| [REQ-3](#req-3-developer-platform-memory-api) | Developer Platform memory API | P1 | New: `/api/v1/developer/memory/*` |
| [REQ-4](#req-4-interruptonhitl-support-for-mcp-sourced-tool-names) | `interruptOn`/HITL support for MCP-sourced tool names | P1 | Existing `interruptOn` config on `PATCH /api/v1/developer/agents/:id` — confirmation only |
| [REQ-5](#req-5-structured-machine-readable-run-errors) | Structured, machine-readable run errors | P1 | Extends the `RUN_ERROR` AG-UI event payload |
| [REQ-6](#req-6-bulk-threadmessage-import) | Bulk thread/message import | P2 | New: `POST /api/v1/developer/threads/import` |
| [REQ-7](#req-7-pluggable-store-bring-your-own-storage-backend) | Pluggable Store (bring-your-own storage backend) | P2 | New: `POST /api/v1/developer/agents/:id/store` + webhook contract |
| [REQ-8](#req-8-uptimelatency-slo-and-incident-communication) | Uptime/latency SLO and incident communication | P2 | New: `GET /api/v1/status` + `POST /api/v1/developer/webhooks` |

---

## REQ-1: Versioned AG-UI custom event contract

**Priority: P0**

### Problem

Your `aguiTranslator.js` emits custom `CUSTOM` AG-UI events (at minimum:
UI-block rendering, subagent activity, HITL/clarification requests) beyond
the base `@ag-ui/core` protocol. We depend on `@ag-ui/core@^0.0.57` — same
version you do — so the *base* protocol is aligned, but the *custom* event
names and payload shapes are not documented anywhere we could find (docs
site pages describing this 403'd during our research pass; we could only
read your source directly). If we build a frontend against today's shape
and you change it, we break silently — no version negotiation, no changelog
to check against.

### Current behavior

Custom events observed in source: `ui_block`, `subagent_activity`,
`hitl_request`, `clarification_request` (naming from our own equivalent
translator, may differ from yours — this is exactly the ambiguity this
request is meant to remove). No endpoint or package export currently
describes these machine-readably.

### Proposed API

**`GET /api/v1/developer/agui/schema?version=latest`**

Request: no body. Auth: Developer Platform credential.

Response `200`:

```json
{
  "schemaVersion": "1.0.0",
  "baseProtocol": "@ag-ui/core@0.0.57",
  "events": [
    {
      "type": "ui_block",
      "description": "Renders a rich UI card in the chat stream.",
      "payloadSchema": { "$ref": "#/definitions/UiBlockPayload" }
    },
    {
      "type": "hitl_request",
      "description": "Pauses the run pending human approval of a tool call.",
      "payloadSchema": { "$ref": "#/definitions/HitlRequestPayload" }
    }
  ],
  "definitions": { "UiBlockPayload": { "type": "object", "...": "..." } }
}
```

Also required: every SSE stream from `POST /api/v1/developer/agui` (and the
SDK's `chat.stream()`) carries a response header
`X-AGUI-Schema-Version: 1.0.0` so callers can detect the active version at
runtime without a separate round trip. Same schema shipped as exported
TypeScript types in `@personaai/sdk` (`import type { UiBlockPayload } from
'@personaai/sdk'`) so we get compile-time checking, not just a runtime
document.

### Use case

We're evaluating whether our existing chat UI (built against our own
AG-UI translator's custom events) can consume yours largely unmodified.
Without a documented, stable contract, we can't sign off on that — every
future deploy on your side is a silent breaking-change risk to our UI.

### Acceptance criteria

- `GET /api/v1/developer/agui/schema` returns every custom event type with
  a resolvable JSON Schema.
- `X-AGUI-Schema-Version` present on every stream response.
- A stated policy for how/when a breaking change bumps the major version
  and how much notice we get beforehand.

---

## REQ-2: Pre-turn dynamic context hook

**Priority: P0**

### Problem

Our current harness re-fetches the founder's live profile (company stage,
sector, funding status, goals) from our own database on *every single model
call*, not just once per thread — explicitly to avoid staleness when a
founder updates their profile mid-conversation. Your platform's equivalent
mechanism (`memory: ['/memories/user/index.md', '/memories/agent/index.md']`)
is loaded once per run and otherwise updated only via the agent's own
`write_file`/`edit_file` tool calls during a turn — there's no hook for us
to push fresh, request-scoped context into the system prompt from outside
the LLM's own tool use.

### Current behavior

Memory files are the only context-injection mechanism, and they're
LLM-controlled (the agent decides what to write) or system-boot-loaded once,
not caller-supplied per turn. No field on the chat request accepts
caller-supplied context today.

### Proposed API

**Option A — inline, per call.** Extend the existing chat request:

`POST /api/v1/developer/agui` (and `PersonaClient.chat.stream()`):

```json
{
  "agentId": "agt_123",
  "externalUserId": "usr_456",
  "threadId": "thr_789",
  "messages": [{ "role": "user", "content": "..." }],
  "contextOverride": "Founder profile (live): stage=seed, sector=fintech, funding_status=raising"
}
```

`contextOverride` is appended to that turn's system prompt only — never
written to any memory file, never persisted beyond the single run.

**Option B — webhook, registered once.** Add a field to agent config:

`PATCH /api/v1/developer/agents/:id`

```json
{ "contextWebhookUrl": "https://onlyfounders.app/api/internal/persona/context" }
```

At the start of every turn for that agent, your backend calls:

`POST https://onlyfounders.app/api/internal/persona/context`
```json
{ "agentId": "agt_123", "externalUserId": "usr_456", "threadId": "thr_789" }
```

and expects back:

```json
{ "context": "Founder profile (live): stage=seed, sector=fintech, ..." }
```

with a documented timeout (e.g. 2s) after which the turn proceeds without
it rather than blocking. Either option satisfies this requirement; we lean
toward Option A (inline) since it avoids us standing up and you depending
on another webhook, but we'll take either.

### Use case

Any agent whose usefulness depends on fresh state we own (founder profile,
current open issues, funding shortlist) — which is most of our roster, not
an edge case.

### Acceptance criteria

- Context supplied this way is visible to the model for that turn.
- It is NOT persisted as a memory file (avoids polluting long-term memory
  with what should be ephemeral, per-turn state).
- Documented token-budget guidance (how large `contextOverride`/the webhook
  response can be before it eats into the effective context window).

---

## REQ-3: Developer Platform memory API

**Priority: P1**

### Problem

`/api/v1/memory` exists but only on the Persona/Clerk-auth (end-user)
side. There is no `/api/v1/developer/memory` route. As the Developer
Platform caller, we have no way to read or write a subject's memory files
except by driving an actual chat turn and hoping the agent's tool calls
happen to touch the right file.

### Proposed API

**`GET /api/v1/developer/memory?externalUserId=usr_456&agentId=agt_123`**
— list files.

Response `200`:
```json
{
  "files": [
    { "path": "/memories/user/index.md", "size": 812, "updatedAt": "2026-08-01T10:00:00Z" },
    { "path": "/memories/agent/index.md", "size": 340, "updatedAt": "2026-08-04T09:12:00Z" }
  ]
}
```

**`GET /api/v1/developer/memory/file?externalUserId=usr_456&agentId=agt_123&path=/memories/user/index.md`**
— read one.

Response `200`:
```json
{ "path": "/memories/user/index.md", "content": "# Founder Memory\n...", "updatedAt": "2026-08-01T10:00:00Z" }
```

**`PUT /api/v1/developer/memory/file`** — write one.

Request:
```json
{ "externalUserId": "usr_456", "agentId": "agt_123", "path": "/memories/user/index.md", "content": "..." }
```
Response `200`: same shape as the read response, with the new `updatedAt`.

**`DELETE /api/v1/developer/memory/file?externalUserId=usr_456&agentId=agt_123&path=/memories/user/index.md`**
Response `204`, no body.

All four scoped the same way `/memories/user/` vs `/memories/agent/`
already is server-side (shared-across-agents vs private-to-one-agent
namespace) — the `path` prefix selects which.

### Use case

- Admin/support tooling: "show me what Maya remembers about founder X" when
  debugging a weird conversation.
- A founder-facing "manage what I've shared with Maya" settings page —
  plausible near-term product feature, currently impossible to build against
  your platform without this.
- Seeding memory ahead of a founder's first conversation (e.g. pre-loading
  known profile facts) without needing to fake a chat turn to do it.

### Acceptance criteria

- Full CRUD parity with what the agent's own file tools can do to these
  paths, exposed over REST with Developer Platform (machine-credential)
  auth.

---

## REQ-4: `interruptOn`/HITL support for MCP-sourced tool names

**Priority: P1**

### Problem

Our interrupt gating currently keys off our own tool names (e.g.
`ask_questions`, `create_issues` on Maya; `propose_issue` on specialists).
Once those tools are registered on our own MCP server (see the note at the
top of this doc) rather than being built-ins, we need confirmation that
`interruptOn` on the agent record gates them identically — pausing the
graph, persisting the interrupt, resumable via the same mechanism
`ChatClient` already exposes (`ChatInterrupt` / `resume`).

### Proposed API

No new endpoint — this is a confirmation/test request against the
**existing** config surface:

`PATCH /api/v1/developer/agents/:id`
```json
{ "interruptOn": { "search_funding_resources": true, "create_issues": true } }
```

where `search_funding_resources` is a tool name that only exists on our
self-registered MCP server, not a built-in. We need this documented (and
ideally covered by your own test suite) to behave identically to
interrupting a built-in tool: pauses the run, the interrupt is resumable via

`POST /api/v1/developer/agui`
```json
{ "agentId": "agt_123", "threadId": "thr_789", "resume": { "decisions": [{ "toolCallId": "tc_1", "approved": true }] } }
```

Nice-to-have: a per-call override — an `interruptOn` field on the chat
request itself, overriding the agent-record default for that one turn.

### Use case

Migrating any of our agents whose product behavior depends on
human-in-the-loop approval before a mutating action (all of them —
`create_issues`/`propose_issue` gate real writes to a founder's board).

### Acceptance criteria

- Confirmed working end-to-end against our real MCP server, not just
  built-ins.
- Interrupt payload shape for MCP-sourced tools documented (does the LLM's
  proposed arguments surface the same way as for built-in tools?).

---

## REQ-5: Structured, machine-readable run errors

**Priority: P1**

### Problem

Our own translator currently does string-sniffing on raw error text to
classify provider failures (`detectProviderName`/`isProviderAuthError` —
bespoke heuristics turning "a raw 401" into "OpenAI has invalid
credentials"). If we delegate execution, we'd inherit whatever error
shape your `RUN_ERROR` AG-UI event carries — if that's also free text, we
either re-implement the same fragile heuristics against *your* error
strings, or we show founders an unhelpful raw error.

### Proposed API

Extend the `RUN_ERROR` AG-UI event payload (emitted over the existing
`POST /api/v1/developer/agui` SSE stream) to:

```json
{
  "type": "RUN_ERROR",
  "code": "PROVIDER_AUTH_ERROR",
  "message": "The configured model provider rejected the request credentials.",
  "retryable": false,
  "providerName": "openai"
}
```

`code` drawn from a documented, stable enum, e.g.:
`PROVIDER_AUTH_ERROR | PROVIDER_RATE_LIMIT | TOOL_TIMEOUT | TOOL_ERROR |
CONTEXT_LENGTH_EXCEEDED | INTERNAL_ERROR`.

### Use case

Showing founders a correct, actionable error state (retry vs. "we're
looking into it" vs. "this conversation is too long, start a new one")
without brittle string matching on your error text.

### Acceptance criteria

- Every `RUN_ERROR` carries a `code` from the documented enum.
- `retryable` is accurate enough that we can safely auto-retry on it.

---

## REQ-6: Bulk thread/message import

**Priority: P2**

### Problem

If we migrate an existing agent (with real conversation history in our own
Postgres checkpointer + `ChatThread`/`ChatMessage` tables) to run on your
platform, founders would lose access to their prior conversation history
unless we can backfill it into your Threads system first.

### Proposed API

**`POST /api/v1/developer/threads/import`**

Request:
```json
{
  "externalUserId": "usr_456",
  "agentId": "agt_123",
  "title": "Fundraising strategy",
  "messages": [
    { "role": "user", "content": "...", "createdAt": "2026-06-01T10:00:00Z" },
    { "role": "assistant", "content": "...", "createdAt": "2026-06-01T10:00:05Z" }
  ]
}
```

Response `201`:
```json
{ "threadId": "thr_new_001", "importedCount": 2, "skippedCount": 0 }
```

Idempotent — re-posting the same payload (matched by a caller-supplied
`idempotencyKey` field, or by exact `externalUserId`+`agentId`+`title`+
first-message-timestamp) returns the existing `threadId` rather than
duplicating.

### Use case

Cutting over Maya (our primary agent, with real founder history already
accumulated) without a "your chat history resets today" regression.

### Acceptance criteria

- Imported threads are indistinguishable from natively-created ones via
  `ThreadsResource.getMessages()` afterward (same shape, resumable the same
  way).

---

## REQ-7: Pluggable Store (bring-your-own storage backend)

**Priority: P2**

### Problem

Today, delegating execution means founder memory and skills move entirely
onto your Mongo, with no way for us to keep that data in our own Postgres
(e.g. for data-residency, backup ownership, or just avoiding a second
source of truth for founder data we otherwise fully own).

### Proposed API

**`POST /api/v1/developer/agents/:id/store`** — register a custom store
webhook for one agent's mount points.

Request:
```json
{
  "mounts": ["/memories/user/", "/memories/agent/"],
  "webhookUrl": "https://onlyfounders.app/api/internal/persona/store",
  "signingSecret": "..."
}
```

Your `StoreBackend` then calls our webhook instead of its own Mongo
`BaseStore` for anything under those mount paths, using a small fixed
operation contract (mirroring LangChain's own `BaseStore` interface, which
your runtime already builds on internally per our reading of
`agent.factory.js`):

```
POST https://onlyfounders.app/api/internal/persona/store
X-Persona-Signature: sha256=...
{ "op": "get" | "put" | "search" | "delete", "namespace": ["users", "usr_456"], "key": "index.md", "value": "..." }
```

expecting back `{ "value": "...", "found": true }` (for `get`/`search`) or
`{ "ok": true }` (for `put`/`delete`).

### Use case

Long-term: any project (not just us) that wants hosted execution without
giving up ownership of the underlying data. This is the highest-leverage,
highest-effort item on this list — we're flagging it as a direction, not
expecting it as a near-term deliverable, and REQ-3 (a memory REST API)
gets us most of the practical benefit (visibility + editability) without
requiring a full pluggable-storage rearchitecture on your side.

### Acceptance criteria

- Not blocking for our pilot — see REQ-3 for the P1-equivalent ask that
  unblocks the same underlying need at far lower implementation cost.

---

## REQ-8: Uptime/latency SLO and incident communication

**Priority: P2**

### Problem

Chat is the core loop of OnlyFounders' product (`docs/api-reference.md`
§1: "the core loop"). Delegating execution makes your platform's
availability and latency a direct, first-party dependency of our primary
user-facing feature, with no current written commitment we could point to.

### Proposed API

**`GET /api/v1/status`** — public, unauthenticated.

Response `200`:
```json
{
  "status": "operational",
  "latencyTargets": { "chatTimeToFirstTokenMsP95": 2000 },
  "uptimeTargetPct": 99.9,
  "incidents": []
}
```

**`POST /api/v1/developer/webhooks`** — subscribe to incident events.

Request:
```json
{ "url": "https://onlyfounders.app/api/internal/persona/incidents", "events": ["incident.created", "incident.resolved"] }
```

We receive a signed `POST` to that URL whenever an incident starts/ends,
same signing convention as REQ-7's store webhook.

### Use case

Setting founder-facing expectations honestly (e.g. whether we can promise
"Maya responds in under N seconds" as a product claim) and knowing when to
proactively communicate an outage rather than finding out from founder
complaints.

### Acceptance criteria

- `GET /api/v1/status` returns real, current numbers (even if informal —
  doesn't need to be a contractual SLA on day one).
- Incident webhook fires reliably enough to be our source of truth for a
  status banner in our own app.

---

## What we're explicitly NOT asking for

To keep this list scoped to real gaps: agent CRUD, skills CRUD, knowledge
base/RAG, provider CRUD, audit logs, and standard MCP server registration +
OAuth are all already exposed via `@personaai/sdk` and meet our needs as-is.
We're not asking for changes to any of those — tool execution specifically
is now handled entirely on our side via a self-hosted MCP server (see the
note at the top of this doc), so no MCP-related ask remains in this list.
