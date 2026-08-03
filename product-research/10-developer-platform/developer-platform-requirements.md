# Persona Developer Platform — Product Requirements & Isolation Model

> **Status: FUTURE DIRECTION — REQUIREMENTS ONLY. NOT ARCHITECTURE. NOT IMPLEMENTATION.**
>
> This document captures the output of an initial requirements-gathering session (2026-07-29) for a
> **future** direction of persona.hasanraiyan.me: exposing Persona's agent infrastructure as a reusable developer
> platform for other products (Beyond Campus, Coursify, OpenFounder, and future products).
>
> Nothing in this document has been implemented. No schemas, APIs, or UI described here exist in the
> codebase. Before any implementation begins, this document requires a **separate codebase research
> pass** and a **separate architecture design pass** (see [Section 33](#33-future-research-required-before-implementation)).
>
> Every statement in this document is labeled:
>
> | Label            | Meaning                                                                 |
> | ---------------- | ------------------------------------------------------------------------ |
> | **[CURRENT]**     | Already implemented in Persona today (verified against the codebase).   |
> | **[REQUIREMENT]** | Approved desired behavior for the future Developer Platform.            |
> | **[DIRECTION]**   | Current product direction, still subject to architecture validation.    |
> | **[OPEN]**        | Not decided. Explicitly deferred.                                       |
> | **[EXAMPLE]**     | Illustrative scenario, not a commitment to specific naming/UI/schema.   |
>
> Related living docs: `product-research/00-product-overview/current-product-state.md` (current Persona
> product state), `AGENTS.md` (current backend module map), `architecture/` (current backend refactor,
> unrelated to this initiative).

---

## 1. Executive Summary

persona.hasanraiyan.me today **[CURRENT]** is a single product with two experiences sharing one backend: the
**Persona** consumer experience (`/dashboard`) and the **Agent Studio** creator experience (`/studio`).
Both are described in `product-research/00-product-overview/current-product-state.md` and `AGENTS.md`.

The manager's broader direction for Agents Marketplace **[DIRECTION]** is to evolve Persona's agent
infrastructure (runtime, DeepAgent, AG-UI streaming, memory, skills, knowledge, MCP, files, providers,
checkpoints) into a **reusable developer platform** that other, fully separate products — Beyond Campus,
Coursify, OpenFounder, and future products — can build on without each reimplementing the same
infrastructure.

The current product direction resembles a **Headless Agent Platform** with a future **Developer Studio**
control plane: host products keep their own UI, users, and business logic, while Persona supplies
runtime infrastructure via a future Developer API. This is a **[DIRECTION]**, not a finalized
architecture.

The single hardest, most-approved requirement is: **shared infrastructure, isolated products.** Host
products (called **Projects**) must never leak data, agents, or users into each other, into Persona's
own marketplace, or into Agent Studio — regardless of how much underlying infrastructure they share.

This document exists to **freeze these requirements in writing** before any codebase research,
architecture design, or implementation begins.

## 2. Problem Statement

**[REQUIREMENT — problem being solved]**

Multiple separate products (Beyond Campus, Coursify, OpenFounder, and future products) each need
similar agent infrastructure: agents, a DeepAgent/runtime, sessions/threads, memory, skills, knowledge,
MCP/tools, files, streaming (AG-UI), providers, checkpoints, user-scoped state, and agent
creation/configuration.

Today, each product that wants this would have to independently build and maintain its own version of
all of the above. This is duplicated effort and duplicated risk (each reimplementation is a fresh
opportunity for security and correctness bugs in areas like auth, isolation, and streaming).

The goal is for Persona to become the **shared infrastructure provider** for these products, so they
consume agent infrastructure through Persona instead of rebuilding it, while remaining fully separate
products from Persona's and each other's perspective.

## 3. Current Persona Product vs Future Developer Platform

| | **Current Persona Product [CURRENT]** | **Future Developer Platform [DIRECTION]** |
| --- | --- | --- |
| Surface | `/dashboard` (consumer), `/studio` (creator) | Not yet built — future Developer Studio control plane |
| Users | Persona users (Clerk-authenticated) | External users authenticated by host products (e.g. Beyond Campus's own auth) |
| Agents | Persona agents, owned by Persona users | Project agents, owned by Projects or Project-scoped external users |
| Discovery | Persona Marketplace (`/dashboard`) | Project's own marketplace/discovery UI (e.g. Beyond Campus's own UI) |
| Creator tool | Agent Studio (`/studio`) | Developer Studio (future, separate control plane for Projects) — **not** a replacement for Agent Studio |
| Backend | `agent-backend/` Express modules (agents, threads, skills, knowledge, mcp, memory, providers, agui, …) | Same underlying infrastructure, consumed via a future Developer API, under Project isolation |

**Agent Studio is not being reinterpreted as Developer Studio.** They are different products for
different audiences:

- **Agent Studio** — normal Persona users create/manage **Persona** agents. Unchanged by this
  initiative.
- **Developer Studio** — developers create/manage **Projects** that consume Persona's agent
  infrastructure for their own separate product. New, future, not yet designed in detail.

## 4. Goals

**[REQUIREMENT]**

- Let external products (Beyond Campus, Coursify, OpenFounder, future products) reuse Persona's agent
  runtime, memory, skills, knowledge, MCP, files, streaming, and provider infrastructure instead of
  rebuilding it.
- Preserve hard isolation between Projects, and between Projects and the existing Persona product.
- Preserve the existing Persona product (Marketplace, Agent Studio, Persona users, Persona agents)
  working exactly as it does today, unaffected by the introduction of Developer Projects.
- Let host products keep full control of their own UI, business logic, branding, authentication, and
  user relationships.
- Reuse Persona's existing conceptual primitives (agents, skills, knowledge, MCP, memory, sessions,
  visibility) rather than inventing a parallel system.

## 5. Non-Goals

**[REQUIREMENT — explicitly out of scope for this initiative]**

- Not building Developer Studio UI now.
- Not building Developer API endpoints now.
- Not designing/creating database schemas now.
- Not refactoring or reinterpreting the existing Agent Studio.
- Not deciding authentication/API-key mechanisms now.
- Not deciding billing, monetization, or provider-cost attribution now.
- Not owning host products' authentication UI, navigation, business logic, branding, or marketplace UX.
- Not merging Persona's marketplace with any Project's marketplace.

## 6. Core Product Principles

**[REQUIREMENT]**

1. **Shared infrastructure, isolated products.** The runtime, DeepAgent, AG-UI, memory engine,
   session/thread infrastructure, skills infrastructure, knowledge infrastructure, MCP infrastructure,
   files, checkpoints, provider infrastructure, and execution infrastructure may be shared. Product
   data and discovery must remain isolated per Project.
2. **Project scope and visibility are different concepts.** `visibility = public` inside a Project
   means public **within that Project**, never globally public on persona.hasanraiyan.me.
3. **Host applications own their product experience.** Persona supplies infrastructure, not the entire
   host product experience (UI, navigation, branding, business logic, marketplace UX belong to the
   host).
4. **Shared agent definition, isolated runtime state.** Multiple users of the same agent share its
   definition (instructions, config, attached skills/knowledge/MCP) but never share private runtime
   state (sessions, memory, files, MCP credentials).
5. **Ownership and administrative authority are different concepts.** A user can own an agent; a
   Project Admin can still act on it administratively. Neither erases the other.
6. **Identity is scoped to a Project.** An external user's identity is only meaningful as
   `(projectId, externalUserId)`, never as a bare global user ID.

## 7. Developer Project Concept

**[REQUIREMENT]**

A **Project** represents an external product/application using Persona infrastructure.

**[EXAMPLE]**

```
Project: Beyond Campus
Project: Coursify
Project: OpenFounder
```

A Project will eventually have credentials (e.g. API keys — exact design **[OPEN]**) so its backend can
authenticate with Persona. A Project is expected to become a major isolation/security boundary.

**[REQUIREMENT — conceptual, not a schema]**

```
Project
|
+-- API credentials
+-- external users
+-- agents
+-- skills
+-- knowledge
+-- MCP definitions/connections
+-- sessions
+-- memory
+-- files
+-- runtime state
+-- usage/logs
```

No schema for the above is being created by this document.

## 8. Project Isolation Model

**[REQUIREMENT]**

A resource belonging to `Project: Beyond Campus` must not automatically be visible/accessible inside:

- Persona Marketplace
- Persona Agent Studio
- Coursify
- OpenFounder
- any other Developer Project

This applies broadly to: agents, users, skills, knowledge, MCPs, sessions, memory, files, credentials,
runtime state.

Persona Marketplace ≠ Beyond Campus Marketplace ≠ Coursify Marketplace ≠ OpenFounder Marketplace —
even though all may use the same underlying infrastructure.

## 9. External User Identity Model

**[REQUIREMENT]**

External products already have their own authentication. We do not want every external user to create
a Persona account merely because Persona powers the agent infrastructure.

**[EXAMPLE]**

Rahul logs into Beyond Campus. Beyond Campus already knows `externalUserId = rahul_123`. When Beyond
Campus's trusted backend calls Persona, the request should conceptually identify:

```
Project = Beyond Campus
External User = rahul_123
```

The important identity boundary is approximately `(projectId, externalUserId)`, **not** a globally
trusted `externalUserId`.

**[EXAMPLE — why scoping matters]**

```
Beyond Campus: externalUserId = rahul_123
Coursify:      externalUserId = rahul_123
```

These must represent completely separate scoped users, even though the raw ID string collides.

Exact authentication/token/API design is **[OPEN]**.

### Trust Model

**[REQUIREMENT]**

```
Rahul
  ↓ Beyond Campus authentication
Beyond Campus backend
  ↓ Persona Developer API
Project identity + external user identity
```

Persona trusts an authenticated Project backend to assert the relevant external user identity, via a
secure mechanism designed later. **Do not assume accepting an arbitrary `userId` header is sufficient**
— this is explicitly called out as an anti-pattern to avoid when the mechanism is designed.

## 10. Agent Ownership Model

**[REQUIREMENT]**

Inside a Developer Project there are two broad agent ownership types: **System/Project Agents** (§11)
and **User-Owned Agents** (§12). Both must ultimately use the same underlying Persona agent
infrastructure — we do not want two separate agent implementations.

## 11. System/Project Agents

**[REQUIREMENT]**

Owned by the Project. Created/configured by Project administrators. Normal Project users may use the
agent according to visibility/access rules but cannot modify its definition.

**[EXAMPLE]**

```
Project: Beyond Campus
|
+-- System Agent
    |
    +-- Beyond Campus Assistant

Owner = Project
Administrative control = Project admins
Runtime users = Beyond Campus users
```

**[REQUIREMENT]** Project ownership must be represented properly (not faked using a random admin
user's ID) when the architecture is designed. Exact representation is **[OPEN]**.

## 12. User-Owned Agents

**[REQUIREMENT]**

Owned by a scoped external user (`projectId + externalUserId`).

**[EXAMPLE]**

```
Project: Beyond Campus
External user: sabik_123
|
+-- Placement Assistant
```

Sabik should be able to create, edit, configure, test, use, publish/change visibility, and
delete/manage his agent through Beyond Campus's own UI. Beyond Campus performs these operations through
Persona's future Developer API. **Sabik does not need to know that Persona powers the infrastructure.**

## 13. Project Admin Authority

**[REQUIREMENT]**

User ownership does not eliminate Project administrator authority.

**[EXAMPLE]**

Sabik creates an abusive/malicious agent. The Beyond Campus Project administrator must be able to:
inspect appropriate metadata/configuration, suspend/disable the agent, remove/delete it where policy
permits, investigate abuse, and enforce Project policy/limits.

**User ownership ≠ administrative authority.** Sabik remains the user-level owner; the Project Admin
acts administratively, not as Sabik.

Future architecture should support auditable actions conceptually like:

```
Agent owner: sabik_123
Action: suspended
Actor: project_admin
Reason: abuse/security/policy
```

Exact audit schema is **[OPEN]**.

## 14. Platform Authority

**[REQUIREMENT]**

Above Project Admin is the Persona platform itself:

```
Persona Platform
      ↓
Project Admin
      ↓
Project User
```

If an entire Project abuses Persona infrastructure, Persona should eventually have platform-level
enforcement authority over that Project. Exact moderation system is **[OPEN]**.

## 15. Agent Visibility Within Projects

**[REQUIREMENT]**

Reuses Persona's existing familiar visibility concepts, but scoped to the Project:

- **PUBLIC** — discoverable/usable by appropriate users within the Project. Does not become
  Persona-public.
- **UNLISTED** — not shown in normal Project discovery; accessible via direct reference/link per
  Project authorization semantics.
- **PRIVATE** — normal Project users cannot discover/use it; the creator can use/manage it; Project
  administrators retain administrative/moderation authority regardless.

**[EXAMPLE]** Sabik creates a public Placement Assistant inside Beyond Campus. Other Beyond Campus
users can discover/use it. It does not become Persona-public.

Exact authorization implementation is **[OPEN]**.

## 16. Project-Scoped Marketplace/Discovery

**[REQUIREMENT]**

A Developer Project may have its own agent ecosystem — e.g. Beyond Campus may expose its own agent
marketplace/discovery UI. Beyond Campus users can potentially create, configure, publish, discover, and
use agents through it. Persona provides the underlying infrastructure; Beyond Campus controls its own
UI/product experience.

A public Beyond Campus agent may be discoverable through Beyond Campus APIs/UI. It must not
automatically appear in Persona's normal marketplace. Likewise, Persona marketplace agents do not
automatically appear inside Beyond Campus.

## 17. Project-Owned Resources

**[REQUIREMENT]**

Projects need shared/project-level resources that Project administrators create/manage, distinct from
resources owned by individual external users (§18).

**[EXAMPLE]**

```
Beyond Campus
|
+-- Project Skills
|   +-- Search Events
|   +-- Find Clubs
|   +-- Get Opportunities
|
+-- Project Knowledge
|   +-- Beyond Campus Documentation
|
+-- Project MCPs
|   +-- Beyond Campus API
|
+-- Agents
    +-- Official Campus Assistant
    +-- user agents
```

Appropriate agents/users may be allowed to attach/use Project-owned resources per future permission
rules. Permission schema is **[OPEN]**.

## 18. User-Owned Resources

**[REQUIREMENT]**

External users should eventually be able to create/manage their own agent resources through the host
application's UI.

**[EXAMPLE]**

```
Beyond Campus
|
+-- User: Sabik
    |
    +-- Agents
    +-- Skills
    +-- Knowledge
    +-- MCPs
```

Beyond Campus provides the UI; Persona provides the underlying infrastructure/API/storage/runtime.
Beyond Campus should not need to independently implement its own skill system, knowledge system, MCP
system, memory system, or agent configuration storage. Exact API surface is **[OPEN]**.

## 19. Shared Agent Definition vs Runtime User State

**[REQUIREMENT — hard architecture requirement]**

Suppose Sabik creates Placement Assistant and makes it public inside Beyond Campus. Rahul, Aman, and
Raiyan all use the **same agent definition** — they may share system instructions, agent configuration,
attached skills, attached knowledge, MCP definitions, and creator/project-provided capabilities. They
must **not** share private runtime/user state: sessions/threads, memory, uploaded files, user-
authenticated MCP credentials, checkpoints/runtime state where user-specific, and other private
execution state.

**[EXAMPLE]**

```
Placement Assistant
|
+-- Rahul
|   +-- Rahul's sessions
|   +-- Rahul's memory
|   +-- Rahul's files
|   +-- Rahul's MCP user logins
|   +-- Rahul's runtime state
|
+-- Aman
|   +-- Aman's sessions
|   +-- Aman's memory
|   +-- Aman's files
|   +-- Aman's MCP user logins
|   +-- Aman's runtime state
|
+-- Raiyan
    +-- Raiyan's isolated state
```

Rahul must never receive Aman's state merely because they use the same agent.

Conceptually, runtime scope is approximately `Project → External User → Agent → Runtime State`, while
the definition belongs approximately to `Project → Agent Owner → Agent Definition`. Exact persistence
design is **[OPEN]**.

## 20. Session/Thread Isolation

**[REQUIREMENT]**

Persona today **[CURRENT]** models conversations as threads with checkpoints (`agent-backend/src/modules/threads/`,
see `agent-backend/docs/modules/threads.md`). In the Developer Platform direction, session/thread
creation and conversation persistence must be reusable by host products without rebuilding it, but every
session/thread must be scoped under `(Project, External User)` isolation — never shared across users or
Projects. Exact API design is **[OPEN]**.

## 21. Memory Isolation

**[REQUIREMENT]**

Persona today **[CURRENT]** has a file-based persistent memory system per user and per agent (see
`agent-backend/src/modules/memory/`, `AGENTS.md` § Agent Memory Implementation Note —
`/memories/user/`, `/memories/agent/`). In the Developer Platform direction, memory must remain
reusable infrastructure, but scoped per `(Project, External User, Agent)` — never merged across users
sharing an agent, and never visible across Projects. Exact persistence design is **[OPEN]**.

## 22. File Isolation

**[REQUIREMENT]**

Uploaded files (agent avatars, knowledge documents, skill snippets today **[CURRENT]** — see
`agent-backend/src/modules/upload/`) must, for the Developer Platform, be scoped per
`(Project, External User)` where user-specific, and per Project where Project-owned. A file uploaded by
Rahul must not be visible to Aman merely because they share an agent. Exact storage/API design is
**[OPEN]**.

## 23. MCP Authentication Model

**[REQUIREMENT — preserve existing distinction]**

Persona today **[CURRENT]** already distinguishes MCP auth modes (see `agent-backend/src/modules/mcp/`,
`agent-backend/docs/modules/mcp.md`). The Developer Platform direction preserves this distinction rather
than redesigning MCP:

- **Mode 1 — Owner/Creator auth.** The agent/resource owner authenticates the MCP (e.g. Sabik attaches
  and authenticates a service). The agent uses that creator/owner-provided capability per configured
  policy. Other users of the agent do not necessarily authenticate separately.
- **Mode 2 — Runtime user auth.** The agent declares that each runtime user must connect their own
  account (e.g. Google Calendar). Rahul connects Rahul's Google account; Aman connects Aman's Google
  account. Their OAuth credentials must remain isolated.

**[EXAMPLE]**

```
Shared Agent
|
+-- Rahul → Rahul's OAuth connection
+-- Aman  → Aman's OAuth connection
```

Execution needs **both** Project identity and runtime external-user identity. The future architecture
should reuse/adapt Persona's existing MCP semantics where possible; MCP is not being redesigned by this
document.

## 24. Developer Studio Concept

**[DIRECTION]**

A future developer-facing control plane, working name **Developer Studio**. Not the existing Agent
Studio.

- **Agent Studio [CURRENT]** — normal Persona users create/manage Persona agents.
- **Developer Studio [DIRECTION]** — developers create/manage Projects that consume Persona's agent
  infrastructure.

**[EXAMPLE — illustrative IA, not finalized]**

```
Developer Studio
|
+-- Projects
    |
    +-- Beyond Campus
        |
        +-- Overview
        +-- API Keys
        +-- Agents
        +-- Users
        +-- Sessions
        +-- Resources
        +-- Usage / Logs
        +-- Settings
```

This information architecture is **not finalized** and must not be read as an implementation
commitment. The approved concept is: **Developer → Project → credentials/API → isolated agent
infrastructure.**

## 25. Host Application Responsibilities

**[REQUIREMENT]**

Beyond Campus remains Beyond Campus. Persona should not own Beyond Campus's authentication UI, product
navigation, business logic, branding, application UX, or marketplace UI. Beyond Campus may build its
own UI (Agents, Featured Agents, Community Agents, Create Agent, Agent Editor, Chat, MCP Connection UI,
etc.) that talks to Persona's developer platform.

## 26. Persona Platform Responsibilities

**[REQUIREMENT]**

Persona supplies reusable infrastructure, not the entire host product experience: agents, runtime,
sessions, memory, skills, knowledge, MCP, files, streaming, providers, etc. — under Project and
external-user isolation.

## 27. Example: Beyond Campus

**[EXAMPLE]**

```
Project: Beyond Campus

Admin creates:      Beyond Campus Assistant  (System/Project Agent)
Sabik creates:       Placement Assistant      (User-Owned Agent)

Placement Assistant:
    scope      = Beyond Campus
    visibility = public

Rahul discovers it inside Beyond Campus. Rahul uses it.

Shared:            agent definition, skills, knowledge, MCP definitions
Rahul-specific:    sessions, memory, files, runtime-user MCP credentials, runtime state

Aman uses the same agent but gets completely separate runtime state.

Coursify cannot see any of these resources.
Persona Marketplace cannot see this agent.
```

This example is meant to make the model understandable to a new engineer without needing the original
requirements-gathering conversation.

## 28. Example: Coursify / OpenFounder

**[EXAMPLE]**

The same model applies unchanged to Coursify and OpenFounder: each is its own Project, with its own
Project Admins, System Agents, User-Owned Agents, Project-owned resources, and externally-scoped users.
`externalUserId = rahul_123` in Coursify is a completely different identity from
`externalUserId = rahul_123` in Beyond Campus (§9). Neither Project can see the other's resources, and
neither can see Persona's or each other's marketplace.

## 29. Security & Isolation Invariants

**[REQUIREMENT — hard invariants]**

1. A Project resource must never become visible in Persona Marketplace merely because `visibility = public`.
2. A public agent is public only within its scope (its Project), never globally.
3. Project A must not access Project B's resources without a future, explicitly designed sharing
   mechanism.
4. `externalUserId` is unique only inside a Project — never treat it as globally unique.
5. Runtime user state must be isolated between users sharing an agent.
6. Agent ownership does not imply ownership of another user's runtime state.
7. Project Admin authority must not be represented as user impersonation.
8. Runtime-user MCP credentials must never be shared between users.
9. Project credentials must never allow accidental access to another Project.
10. Existing Persona resources must not automatically leak into Developer Projects.
11. Developer Project resources must not automatically leak into Persona.
12. Host applications authenticate their own users; Persona must securely scope the asserted external
    identity to the authenticated Project (never trust a bare, unauthenticated user-id header — see §9
    Trust Model).

## 30. Requirements Matrix

| # | Requirement | Label | Section |
| --- | --- | --- | --- |
| 1 | Shared infrastructure, isolated products | REQUIREMENT | §6, §8 |
| 2 | Project scope ≠ global visibility | REQUIREMENT | §6, §15 |
| 3 | Host owns its own product UX | REQUIREMENT | §25 |
| 4 | Shared agent definition, isolated runtime state | REQUIREMENT | §19 |
| 5 | Ownership ≠ administrative authority | REQUIREMENT | §13 |
| 6 | Identity scoped to `(projectId, externalUserId)` | REQUIREMENT | §9 |
| 7 | System/Project agents owned by Project | REQUIREMENT | §11 |
| 8 | User-owned agents owned by scoped external user | REQUIREMENT | §12 |
| 9 | Project Admin can moderate user-owned agents | REQUIREMENT | §13 |
| 10 | Platform authority above Project Admin | REQUIREMENT | §14 |
| 11 | Public/Unlisted/Private visibility, scoped to Project | REQUIREMENT | §15 |
| 12 | Project-scoped discovery/marketplace, distinct from Persona Marketplace | REQUIREMENT | §16 |
| 13 | Project-owned resources (skills/knowledge/MCP) distinct from user-owned | REQUIREMENT | §17, §18 |
| 14 | Sessions/memory/files reusable but user+project scoped | REQUIREMENT | §20, §21, §22 |
| 15 | MCP owner-auth vs runtime-user-auth preserved | REQUIREMENT | §23 |
| 16 | Single underlying agent implementation for both UI and API creation paths | REQUIREMENT | §10, implied by "Agent Creation Through UI and API" |
| 17 | Existing Persona product keeps working unmodified | REQUIREMENT | §33, §3 |
| 18 | Developer Studio ≠ Agent Studio | REQUIREMENT | §24 |

## 31. Open Product Questions

**[OPEN]**

- What exactly does a Project Admin role look like (single owner vs. multiple admins vs. RBAC)?
- What quotas/limits apply per Project, and who sets them?
- Does a Project need multiple environments (dev/staging/production)?
- How does a Project migrate/import/export agents, or share resources with another Project?
- What does provider (LLM) credential ownership and billing attribution look like across Projects?
- What does platform-level moderation of an abusive Project actually look like in practice?
- Does Developer Studio need its own onboarding/signup flow distinct from Persona's?

## 32. Unresolved Technical Architecture Questions

**[OPEN — explicitly not decided by this document]**

- Project database schema
- Tenant/scoping implementation approach
- Whether existing collections gain a `projectId` field, or Project resources use separate collections
- API key format
- API key storage
- Project authentication protocol
- End-user identity assertion mechanism (how a Project backend securely asserts `externalUserId`)
- SDK design
- REST vs AG-UI responsibilities split
- Exact Developer API endpoints
- Exact Developer Studio information architecture
- RBAC implementation
- Project-admin role model
- Audit-log schema
- Quotas
- Billing
- Rate limits
- Webhooks
- Environments (development/staging/production)
- Project secrets management
- Agent versioning
- Resource permission model
- Project-resource sharing rules
- Cross-project sharing
- Persona ↔ Project resource import/export
- Provider credential ownership/billing
- Platform monetization
- Deployment model

None of the above should be silently decided in any follow-on document without an explicit design pass.

## 33. Future Research Required Before Implementation

**[REQUIREMENT — process, not architecture]**

Before any implementation begins, the following must happen as **separate, later efforts**:

1. **Codebase research** — a dedicated pass over `agent-backend/src/modules/` (agents, threads, skills,
   knowledge, mcp, memory, providers, agui, tools, upload, users) to determine how much of the current
   single-tenant (Persona-user-scoped) design can be extended to Project-scoping versus what needs
   fundamental rework. This document intentionally does not attempt this analysis.
2. **Architecture design** — a dedicated pass to resolve the questions in §32, informed by (1), producing
   an actual technical design (schema, auth protocol, API surface) before any code is written.
3. **Implementation plan** — only after (1) and (2), a staged implementation plan that guarantees the
   existing Persona product (§33.1 below) is never put at risk.

### 33.1 Existing Persona Must Remain Working

**[REQUIREMENT]**

A future Developer Platform must not destroy the current Persona product. Current Persona — Marketplace,
Agent Studio, Persona users, Persona agents — must continue working. The future architecture should
ideally allow the existing Persona product to coexist with Developer Projects on shared infrastructure.
How that is modeled technically is a future architecture question (§32).

## 34. Glossary

| Term | Meaning |
| --- | --- |
| **Persona** | The current consumer experience (`/dashboard`). [CURRENT] |
| **Agent Studio** | The current creator experience (`/studio`) for Persona users to build agents. [CURRENT] |
| **Developer Platform** | The future direction: exposing Persona's agent infrastructure to external products. [DIRECTION] |
| **Developer Studio** | The future control plane where developers manage Projects. Not Agent Studio. [DIRECTION] |
| **Project** | An isolated external product/app that consumes Persona infrastructure, e.g. Beyond Campus. [REQUIREMENT] |
| **External User** | A user of a Project, identified as `(projectId, externalUserId)`, authenticated by the Project's own auth, not a Persona account. [REQUIREMENT] |
| **System/Project Agent** | An agent owned by the Project itself, managed by Project Admins. [REQUIREMENT] |
| **User-Owned Agent** | An agent owned by a scoped external user within a Project. [REQUIREMENT] |
| **Project Admin** | An administrator of a Project with moderation/administrative authority over that Project's resources, distinct from resource ownership. [REQUIREMENT] |
| **Platform Authority** | Persona's own authority above Project Admins, for platform-level enforcement. [REQUIREMENT] |
| **Visibility (Public/Unlisted/Private)** | Existing Persona visibility concepts, reused but scoped to the Project rather than global. [REQUIREMENT] |
| **Agent Definition** | The shared configuration of an agent (instructions, skills, knowledge, MCP definitions) used by all its runtime users. [REQUIREMENT] |
| **Runtime State** | Per-user execution state (sessions, memory, files, MCP credentials) that must never be shared across users of the same agent. [REQUIREMENT] |
| **MCP Owner/Creator Auth** | MCP auth mode where the agent creator authenticates the connection once, shared by all runtime users. [CURRENT — preserved as-is] |
| **MCP Runtime User Auth** | MCP auth mode where each runtime user must connect their own account/credentials. [CURRENT — preserved as-is] |
| **AG-UI** | Persona's current agent-to-frontend streaming protocol. [CURRENT] |
| **DeepAgent** | Persona's current LangGraph-based agent runtime. [CURRENT] |

---

## Control Matrix

**[REQUIREMENT — conceptual control matrix, not a permission-system design]**

Columns are actors. Rows are capabilities. Cell values describe the actor's *relationship* to that
capability — this is not an implementation of RBAC, just a way to keep "user" from being flattened into
one undifferentiated role.

| Capability | Persona Platform | Project Admin | External User / Agent Creator | Runtime User | Host Application |
| --- | --- | --- | --- | --- | --- |
| Project creation | PLATFORM AUTHORITY | — | — | — | — |
| API keys (Project credentials) | PLATFORM AUTHORITY (issues) | OWNER (holds/rotates) | — | — | HOST APPLICATION (uses, server-side only) |
| System/Project agents | ADMIN AUTHORITY (moderation) | OWNER | — | RUNTIME USER (uses per visibility) | — |
| User-owned agents | ADMIN AUTHORITY (moderation) | ADMIN AUTHORITY (suspend/remove) | OWNER (creates/edits/publishes) | RUNTIME USER (uses per visibility) | HOST APPLICATION (mediates calls) |
| Agent configuration | — | ADMIN AUTHORITY (project agents) | OWNER (own agents) | — | — |
| Visibility (public/unlisted/private) | — | ADMIN AUTHORITY (override/enforce) | OWNER (sets, own agents) | — | — |
| Moderation / abuse enforcement | PLATFORM AUTHORITY (project-level) | ADMIN AUTHORITY (agent/user-level) | — | — | — |
| Project skills/knowledge/MCP (project-owned) | — | OWNER | — (unless granted) | RUNTIME USER (uses if attached) | — |
| User skills/knowledge/MCP (user-owned) | — | ADMIN AUTHORITY (moderation) | OWNER | — | — |
| MCP owner/creator auth | — | — | OWNER (authenticates once) | RUNTIME USER (uses shared capability) | — |
| MCP runtime-user auth | — | — | — | RUNTIME USER (connects own account) | — |
| Sessions/threads | — | ADMIN AUTHORITY (visibility into project, not content, per policy — [OPEN]) | — | RUNTIME USER (owns own sessions) | — |
| Memory | — | — | — | RUNTIME USER (owns own memory) | — |
| Files | — | — | OWNER (project-owned files) | RUNTIME USER (owns own files) | — |
| Agent discovery | — | ADMIN AUTHORITY (project-scoped discovery policy) | — | RUNTIME USER (discovers per visibility) | HOST APPLICATION (builds discovery UI) |
| UI / product experience | — | — | — | — | HOST APPLICATION (owns fully) |
| End-user authentication | — | — | — | — | HOST APPLICATION (authenticates its own users) |
| Runtime (agent execution) | PLATFORM AUTHORITY (provides infra) | — | — | RUNTIME USER (triggers execution) | HOST APPLICATION (invokes on user's behalf) |
| Usage / logging | PLATFORM AUTHORITY (platform-wide) | ADMIN AUTHORITY (project-scoped, [OPEN] on detail) | — | — | — |

Legend: **PLATFORM AUTHORITY** = Persona-wide enforcement power. **ADMIN AUTHORITY** = administrative
power scoped to one Project, distinct from ownership. **OWNER** = creator-level control over a specific
resource. **RUNTIME USER** = end-user interacting with a shared resource, isolated runtime state only.
**HOST APPLICATION** = the external product's own backend/UI, mediating between its users and Persona.

---

*This document is a product requirements snapshot from the 2026-07-29 requirements-gathering session.
It intentionally does not specify schemas, APIs, or UI. See §33 for what must happen before
implementation.*
