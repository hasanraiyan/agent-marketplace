# Re: Agent Marketplace Platform — Requirements from OnlyFounders

**From:** Agent Marketplace platform team
**To:** OnlyFounders engineering
**Re:** [`only-founders-requirements.md`](./only-founders-requirements.md)

Thanks for this — it's the most useful requirements doc we've gotten from a
Developer Platform consumer. You clearly read the actual source, not just
the docs site, and it shows: most of your claims about current behavior are
exactly right, down to specific function and field names. That let us
respond with real specifics instead of "let us get back to you."

Below is our response per requirement: what we're accepting as-is, what
we're modifying, and one item where we think the actual lift is bigger than
your sketch implies and we'd like to renegotiate scope before committing.

---

## P0 — accepted, both buildable for the pilot

### REQ-1: Versioned AG-UI custom event contract

Accepted as specified. One correction to your own research: there's a
**fifth** custom event you didn't catch — `mcp_app`, emitted when an
MCP-registered tool declares a widget via `_meta.ui.resourceUri`. Since
you're standing up your own MCP server for `create_issues`,
`search_funding_resources`, etc., this is directly relevant to you, not a
theoretical gap — any of those tools that surface a `_meta.ui` block will
emit this event, and your frontend should know to expect it. We'll include
it in the schema from day one.

We'll build:
- `GET /api/v1/developer/agui/schema` covering all five event types
- `X-AGUI-Schema-Version` header on every stream response
- Exported TS types in `@personaai/sdk`

On the versioning policy: we'll commit to semver for this schema (major
bump = breaking payload change) with a minimum notice window before a major
bump ships. We'll propose specifics (we're thinking 30 days minimum,
possibly tied to a deprecation header on the old version) once we've built
the endpoint — easier to commit to a real number once we've seen how often
this actually needs to change.

### REQ-2: Pre-turn dynamic context hook

Accepted — **Option A (inline `contextOverride`)**, matching your
preference. It's also the cheaper build on our end: we have zero
outbound-webhook infrastructure in the backend today, so Option B would
mean standing up webhook delivery, retries, and timeout handling from
scratch just for this. Option A is a straight append to that turn's system
prompt before the graph runs, confirmed not persisted to any memory file.

We'll document token-budget guidance for `contextOverride` size once it's
built and we can measure real impact on effective context window at your
typical thread lengths.

---

## P1 — accepted, needed before Maya moves to production

### REQ-3: Developer Platform memory API

Accepted as specified — full CRUD, developer-credential auth, mirrors the
existing `/api/v1/memory` route pattern. This one's cheaper for us than it
might look from outside: the underlying storage/namespace logic is already
factored out generically, not Clerk-specific, so it's largely a new
controller over existing service code.

One thing we caught that you should know about regardless of when we ship
this: memory is namespaced internally by `domain:externalUserId`, not raw
`externalUserId`. If we (or you, later) ever build tooling that reads
memory by `externalUserId` alone without that domain qualification, it'll
read a different namespace than what live agent runs actually use — your
"show me what Maya remembers about founder X" support use case would
silently show stale or wrong data. We'll make sure the new endpoint handles
this correctly; flagging it so it's on your radar too if you ever build
anything that touches memory paths directly.

### REQ-4: `interruptOn`/HITL support for MCP-sourced tool names

This should already work today — interrupt gating matches purely on tool
name against a flat list that already merges built-in and MCP-sourced tools
before HITL logic ever sees it, so there's no code path that distinguishes
origin. We'll run this as an explicit test against your real MCP server
once it's registered rather than a code change, and document the interrupt
payload shape for MCP tool args (there's a known argument-envelope quirk
from `@langchain/mcp-adapters` we want to confirm doesn't leak through) —
should be quick to close out.

### REQ-5: Structured, machine-readable run errors

Accepted, with an expectation-setting note. There's currently no
`RUN_ERROR` event at all — errors surface as plain text today, so this is
new work, not an extension of existing structure. We'll build the `code`
enum and `RUN_ERROR` event as specified.

Worth knowing before you build `retryable`-driven auto-retry logic against
it: this backend proxies arbitrary OpenAI-compatible `baseURL`s per
provider, so "the provider" isn't a small fixed set we can special-case
exhaustively. The auth-error case will be reliable quickly; rate-limit,
timeout, and context-length classification will start out best-effort and
improve as we see real error shapes from whatever providers you actually
configure. We'll ship the enum now and treat classification accuracy as an
ongoing quality bar, not a one-time deliverable — happy to take a feed of
misclassified errors from you post-launch to tighten it.

---

## P2 — one scope concern, two sequencing notes

### REQ-7: Pluggable Store

Good news: this is less of a rearchitecture than your doc assumes.
Per-mount-point store swapping is already a live pattern in our factory —
`/skills/`, `/memories/user/`, and `/memories/agent/` are each already
independent store instances composed together. A webhook-backed store for
your mounts fits that same shape rather than requiring new architecture.
What's actually missing is (a) a per-agent config field to select an
alternate store, and (b) outbound-webhook signing/delivery infrastructure,
which we don't have yet at all.

Agreed this isn't a near-term deliverable. Noting it here because of the
next item.

### REQ-8: Uptime/latency SLO and incident communication

`GET /api/v1/status` is cheap and we can ship it early, even with informal
numbers as you suggested. The incident webhook needs the same
outbound-signing/delivery infrastructure as REQ-7's store webhook — if
either of these becomes real, we'll build that layer once and it serves
both. Worth keeping in mind if you ever want to prioritize REQ-7 sooner:
the webhook infra is shared cost, not duplicated cost.

---

## Suggested sequencing

1. REQ-1 + REQ-2 (P0, both accepted as-is) — unblocks your pilot.
2. REQ-3 + REQ-4 (P1, both cheap — REQ-4 may just be a test) — unblocks
   Maya's production move.
3. REQ-5 (P1, real new work, ship with the expectation-setting above).
4. REQ-6 — need a scoping conversation before we commit to a version.
5. REQ-7/REQ-8 — no near-term commitment, but we'll design the shared
   webhook-signing layer with both in mind if/when either gets prioritized.

Happy to get on a call to talk through REQ-6 scope and the versioning
policy specifics for REQ-1 whenever works for you.
