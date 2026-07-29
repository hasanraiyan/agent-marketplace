# Architecture Decision 02 — External User Identity

> **Status:** DECIDED (this document). Scope: how an already-authenticated Project asserts which
> of its own end users a request is being made on behalf of. Starts strictly **after** the
> Architecture Decision 01 boundary — Project authentication itself is not revisited here.
> **Explicitly NOT decided here:** Project database schema, ExternalUser database schema,
> ownership polymorphism, Project Admin RBAC, collection-vs-field tenancy, Developer REST
> endpoints, Developer Studio UX, SDK surface, billing, quotas. Where this decision creates
> constraints on those areas, they are recorded as **consequences** (§21, §23), not designed.
> **Inputs:** `product-research/10-developer-platform/developer-platform-requirements.md`
> (product truth), `product-research/10-developer-platform/05-codebase-readiness-synthesis.md`
> (codebase evidence), `product-research/10-developer-platform/architecture/01-project-authentication.md`
> (the foundation this decision builds on, not redesigns).
> **Labels used throughout:** DECISION / FACT / EVIDENCE / ASSUMPTION / OPEN.

---

## 1. Decision

**DECISION:** Within a request that has already passed the Architecture Decision 01 Project
Authentication Boundary, an authenticated Project asserts an external user's identity by including
an **`externalUserId`** value directly in that same authenticated, TLS-protected request (as a
header or body field — exact wire location is an implementation-phase detail, not decided here).
**No additional cryptographic signature, token, or delegated-credential exchange is required for
this assertion.**

Persona treats the Project as **fully authoritative** for the identity of its own users. Once the
Project itself is cryptographically authenticated (Decision 01), the integrity and authenticity of
everything inside that same request — including the `externalUserId` field — is already guaranteed
end-to-end by TLS plus the Project credential. Adding a second signature over a value that already
travels inside an authenticated, tamper-evident channel would not close any attack that channel
does not already close (§10 explains this precisely, and contrasts it with the one place in the
existing codebase where a signature genuinely *is* required for exactly this reason: MCP OAuth
state, §16).

The resulting runtime identity is always the **compound pair** `(projectId, externalUserId)`,
where `projectId` comes exclusively from the trusted Decision 01 context and `externalUserId`
comes exclusively from the Project's assertion. This pairing — not the externalUserId alone — is
what makes cross-Project impersonation structurally impossible (§15).

---

## 2. Context

Architecture Decision 01 established how Persona verifies **which application** is calling
(`AuthenticatedProjectContext { projectIdentity, credentialIdentity }`, both cryptographically
trusted). It explicitly left open **which end user, if any, that application is acting on behalf
of** — this document answers that question.

Per the requirements document's Trust Model (§9): "External product authenticates its own users
... Persona trusts an authenticated Project backend to assert the relevant external user identity
according to whatever secure mechanism we design later." This is that mechanism.

**FACT** (synthesis §5, re-confirmed): today, Persona's only principal type is a Clerk-
authenticated Persona User, and `userId` is resolved exclusively from a verified Clerk JWT —
Persona has never had to trust a *third party's* assertion about a user's identity before. The
closest existing precedent is the MCP OAuth signed-state mechanism (`oauth-state.js`), which
conveys identity across an *unauthenticated* redirect hop through the end user's own browser. This
decision explicitly evaluates whether that precedent applies here, and concludes it does not
(§10, §16) — the two scenarios have a materially different trust topology.

---

## 3. Trust Model

```
Rahul
  ↓  Beyond Campus's own authentication (unrelated to Persona)
Beyond Campus backend
  ↓  authenticated with its Project credential (Decision 01)
  ↓  asserts: externalUserId = "rahul_123"
Persona
  ↓  pairs the TRUSTED projectId (from the credential) with the ASSERTED externalUserId
Runtime identity: (BeyondCampusProject, "rahul_123")
```

**DECISION:** Persona does not, and architecturally cannot, independently verify that "rahul_123"
corresponds to a real person named Rahul, or that Beyond Campus correctly authenticated him. Persona
verifies only two things: (1) that the request genuinely comes from an authenticated Beyond Campus
credential (Decision 01), and (2) that the resulting compound identity is safely non-colliding with
every other Project's identities (§15). Everything about the real-world correctness of "this is
actually Rahul" is delegated entirely to Beyond Campus, by design — this is the explicit trust
delegation the requirements document's Trust Model section describes.

---

## 4. Identity Authority

**Core Question 1, answered directly: the Project is authoritative for its own users' identity.
Persona is not, and does not attempt to be.**

Persona has no relationship with Rahul as a person — no credentials of his, no way to challenge
him, no independent signal about who he is. Beyond Campus does have that relationship (it already
authenticated him through its own system, however it works — password, SSO, magic link, etc. —
details Persona never sees and does not need to see). Requiring Persona to *also* independently
authenticate Rahul would directly contradict the requirement that "we do NOT want every Beyond
Campus user to create a Persona account simply because Persona powers the agent infrastructure"
(requirements §9). The entire value proposition of the Developer Platform depends on Persona
accepting delegated identity assertions from trusted, authenticated Projects rather than becoming a
second identity provider its host products' users must also enroll in.

This has a direct, important consequence answered in §15: since Persona doesn't independently
verify externalUserId, **the only thing standing between "safe delegation" and "any Project can
claim to be any user of any other Project" is the Decision 01 credential boundary.** That boundary
must hold perfectly, which is exactly why Decision 01's guarantee ("projectId is never taken from
caller input, always resolved from the authenticated credential") is the load-bearing invariant
this entire decision depends on and reuses without modification.

---

## 5. Requirements (Restated From Task Brief, Unweakened)

The mechanism must: establish `(projectId, externalUserId)` as the conceptual runtime-identity
boundary; make cross-Project impersonation of another Project's user structurally impossible;
correctly treat within-Project user assertion as the Project's legitimate authority, not a
vulnerability to cryptographically block; define external-user provisioning lifecycle semantics
(without a database schema); distinguish identity from mutable profile metadata; define the runtime
context handed to later layers with explicit TRUSTED/DERIVED/UNTRUSTED labeling; establish (without
designing) the isolation invariant that threads, checkpoints, memory, files, MCP runtime-user
credentials, AgentFactory cache, and rate limits must all become Project-qualified; explain the
interaction with existing MCP `authMode: 'user'` semantics; and explicitly resolve whether
additional cryptographic assertion beyond Project authentication is justified.

---

## 6. Existing Persona Constraints (Evidence From the Synthesis and Decision 01)

| Constraint | Status | Evidence |
|---|---|---|
| Project identity is already cryptographically established before this layer runs | **FACT** (by construction) | `architecture/01-project-authentication.md` §10, §14 |
| `projectId` is never trusted from caller input, only from the authenticated credential record | **FACT** (by construction) | Decision 01 §12.10, §14 |
| Today's only identity precedent is Clerk (fully independent 3rd-party-authenticated); there is no precedent for Persona *trusting a relayed assertion* about identity | **FACT** | Synthesis §5, §13, §19 |
| MCP OAuth signed-state is the only session-independent identity-assertion mechanism in the codebase, and it exists specifically to survive an *unauthenticated browser redirect hop* | **FACT** | Decision 01 §19 (re-read directly: `oauth-state.js`); re-examined here in §16 for why its rationale does *not* transfer to this decision |
| Every current runtime storage key (threads, memory, checkpoints, MCP user connections, AgentFactory cache, rate limiter) is keyed on a bare `userId` with no second (tenant) dimension | **FACT** | Synthesis §8, §15, §16, §20 |
| `thread.agentId` is never compared against the requested `x-agent-id` when resuming a thread | **FACT** (independently re-verified in the synthesis, not just cited) | Synthesis §10, §21.1, §22.5 |
| `authMode: 'owner'` vs `authMode: 'user'` MCP distinction already exists and is rated GREEN (directly reusable) | **FACT** | Synthesis §7, §12 |

---

## 7. Industry Patterns Considered

Researched per the "do not reinvent the wheel" principle, evaluated against Persona's actual
topology (a single, direct, TLS-protected, server-to-server hop — not a multi-hop or
browser-mediated flow):

- **Trusted-subsystem / assertion-inside-authenticated-channel** (how most B2B SaaS platforms with
  a "connect your users" story work once the calling backend itself is API-key authenticated — e.g.
  Intercom, Twilio, SendGrid sub-user/on-behalf-of patterns, Stripe Connect's `Stripe-Account`
  header on requests already authenticated with the platform's own secret key) — identity of the
  "acted-upon" party travels as a plain field inside an already-authenticated request; no separate
  signature.
- **OAuth 2.0 Token Exchange (RFC 8693)** — a caller exchanges one token (representing itself) for
  another token (representing a delegated subject), typically used when the resulting token needs
  to be handed to a *different, less-trusted* component than the one holding the original
  credential.
- **JWT Bearer Assertion for identity propagation** (RFC 7523-style, or SAML-assertion-in-header
  patterns used in some enterprise SSO relay scenarios) — the calling party signs a JWT claiming
  "I am acting as user X," typically used when the assertion must be independently verifiable by a
  party that does not have a live, authenticated channel back to the original issuer.
- **On-behalf-of headers within an already-authenticated API-key request** (e.g., many
  multi-tenant SaaS APIs' `X-On-Behalf-Of` / `X-Impersonate-User` style headers, accepted at face
  value once the calling API key itself is verified) — the most directly analogous pattern to
  Persona's situation: single-hop, key-authenticated, no untrusted intermediary.
- **Signed callback/redirect-state tokens** (OAuth `state` parameter conventions, exactly what
  Persona's own MCP module already implements) — used specifically when identity must survive a
  hop through an untrusted party (a browser, a third-party redirect). Evaluated and found
  **inapplicable** to this decision's topology (§10, §16).

---

## 8. Options Considered

### A. Authenticated Project request + external user ID header

`externalUserId` supplied as a request header (e.g. illustratively `X-Persona-External-User-Id`),
read only after the request has already passed Decision 01's credential check.

### B. Authenticated Project request + external user ID in request body

Same trust model as A, differing only in wire location (a JSON body field instead of a header).

### C. Project-signed external-user assertion

The Project additionally computes a signature (e.g., HMAC using a secret it holds, or a signature
over `{externalUserId, timestamp}`) and includes it alongside the plain `externalUserId` value.

### D. Short-lived Persona-issued user token

The Project first calls a separate Persona endpoint to "check in" a user, receiving back a
short-lived token specific to `(projectId, externalUserId)`, which it then presents on subsequent
runtime calls instead of a raw `externalUserId` field.

### E. Project-generated JWT representing its user

The Project holds its own signing key (separate from its Persona credential) and issues a
self-contained JWT asserting `{ projectId, externalUserId, iat, exp }`, which Persona verifies
against a registered public key.

### F. Token-exchange / delegated-token pattern

Formal RFC 8693-style exchange: the Project presents its Project credential plus an
`externalUserId` assertion to a token endpoint and receives a scoped, delegated access token
representing `(projectId, externalUserId)`, intended to be handed to downstream components that
should not hold the raw Project secret.

### G. Hybrid — none genuinely justified for v1

Considered and, as in Decision 01, not adopted now — see §20.4 for why, and §21 for why it remains
available as a future evolution without redesigning what's decided here.

---

## 9. Comparison Matrix

| Criterion | A/B. Inline assertion (recommended) | C. Project-signed assertion | D. Persona-issued short-lived user token | E. Project-generated JWT | F. Token exchange |
|---|---|---|---|---|---|
| Additional security benefit beyond Project-credential auth + TLS | None — the whole request, including this field, is already integrity-and-authenticity protected end-to-end (§10) | None in this topology — the signature is redundant with what TLS + the credential already guarantee for a single-hop request | None for the *identity assertion itself*; the only real benefit is enabling safe delegation of a scoped token to a *different, less-trusted* downstream component — not a need Persona has stated | None in this topology, for the same reason as C | Real benefit only materializes if a *third, less-trusted* component needs the resulting scoped identity without holding the raw Project secret — not a stated v1 requirement |
| Implementation complexity | Lowest — read a field after existing auth middleware | Medium — Project must manage a signing key/secret and Persona must verify it | Medium-High — new token-issuance endpoint, expiry/refresh handling on both sides | High — asymmetric key registration and JWT verification infrastructure, none of which exists today | Highest — full exchange endpoint plus scoped-token issuance and verification |
| Developer experience | Excellent — one extra field per request | Worse — extra signing step per request or per session | Worse — extra round trip + token caching logic before every user-scoped call | Worst — key management burden mirrors Decision 01's rejection of signed-JWT client assertion (§15.2 there) for the same DX reasons | Worst — full OAuth-exchange integration burden |
| Revocation of a specific assertion | N/A — nothing separate to revoke; revoking the Project credential (Decision 01) revokes everything | Requires a separate signing-key revocation story | Requires token revocation/blacklisting or short TTL | Requires signing-key revocation | Requires delegated-token revocation, on top of Decision 01's credential revocation |
| Compatibility with runtime/MCP scoping (§16–17) | Direct — the resolved `(projectId, externalUserId)` pair is exactly what downstream scoping needs | Same, once verified — no additional benefit to scoping | Same, but adds a token-freshness dependency to every runtime call | Same, but adds signature-verification cost to every runtime call | Same, but adds exchange-latency to the critical path |
| Compatibility with existing Persona infra | High — mirrors Decision 01's own "read a field after middleware-verified auth" pattern | Low — no existing Project-side signing-key infrastructure to build on | Low — no token-issuance infra exists (synthesis §13, §19-#5, same gap Decision 01 flagged for OAuth Client Credentials) | Low — no asymmetric-key infra exists | Low — same gap as D, formalized |
| Extensibility | Good — the field/pairing pattern generalizes cleanly if richer assertions are needed later | Adds a cryptographic primitive that would need to evolve independently | Could evolve into Decision 01 §15.3's deferred token-exchange hardening layer later, if ever justified | Could substitute for C later if a genuine multi-hop need emerges | The natural formalization of D, deferred for the same reason |

---

## 10. Selected Model

**DECISION: Options A/B combined (wire location is an implementation detail) — inline
`externalUserId` assertion inside the already Decision-01-authenticated request. No additional
signature, token, or exchange step.**

**"Explain the security difference precisely," as the task requires:**

The MCP OAuth signed-state mechanism (`oauth-state.js`, re-examined directly again for this
decision) exists because its payload must survive a hop through an **untrusted intermediary**: the
end user's own browser, redirected to and from an external OAuth provider. During that hop, the
payload travels as a URL query parameter, fully visible to and modifiable by the browser and any
network party in between, and the callback request that eventually reaches Persona carries **no
authenticated session at all** — Persona has no other way to know the callback is legitimate except
by verifying the signature on the state it itself issued earlier. The signature is what lets an
*unauthenticated* callback request be trusted.

This decision's topology is fundamentally different: the `externalUserId` assertion travels in a
**single hop**, directly from the Project's own backend to Persona's Developer API, inside **one
TLS-protected HTTPS request that has already been authenticated** via the Decision 01 Project
credential. There is no browser, no third-party redirect, and no untrusted intermediary anywhere in
this path. TLS already provides end-to-end confidentiality and integrity for the *entire* request —
headers and body alike — between two endpoints that have already proven who they are to each other
(the Project, via its credential; Persona, via its own TLS certificate). Adding a second signature
over one specific field inside a channel that is already tamper-evident in its entirety protects
against nothing that channel doesn't already prevent. It would only earn its cost if (a) the
assertion needed to survive a hop through a party Persona does not trust (it doesn't, in this
model), or (b) Persona needed to verify the assertion independently of the live authenticated
connection, e.g. hours later without re-contacting the Project (no stated requirement asks for
this). Per §16, the *existing* signed-state mechanism remains exactly the right tool — for a
*different* leg of a *different* flow (the MCP OAuth browser-redirect leg), not for this one.

**This directly answers the "do not overengineer" section of the task brief: no, additional
cryptographic user assertion provides no real security benefit here, and the reasoning above is
why**, not merely an assertion that it's unnecessary.

---

## 11. External User Lifecycle

**Core models compared, per task instruction (lifecycle semantics only, no schema):**

### 11.1 Lazy / JIT resolution — **DECISION: selected**

On the first request Persona ever sees for a given `(projectId, externalUserId)` pair, it
resolves-or-creates a minimal internal runtime-identity handle for that compound key. On every
subsequent request with the same pair, the same handle is resolved deterministically — this is
**idempotent resolution, not re-creation**. This directly mirrors an existing, already-proven
Persona pattern: **FACT**, `authService.syncUser(clerkId)` already does exactly this shape of
lazy resolve-or-create for Clerk identities today, with no invite/approval gate (synthesis §5, §13).
Decision 02 reuses the *shape* of that precedent for a different identity source — it does not reuse
Clerk-specific code, since external users are never Clerk users (§4).

**Why selected over the alternatives:**

### 11.2 Explicit user-registration endpoint — rejected as unnecessary friction

A model where the Project must call a "register this user" API before any runtime call on that
user's behalf. Rejected for v1: it adds a mandatory extra integration step and a mandatory extra
round trip for every new end user, without buying any additional security — the Project is already
authoritative and already authenticated (§4), so a separate registration step doesn't establish any
fact Persona doesn't already accept implicitly. **This can remain available later as an *optional*
convenience** (e.g., to pre-create a runtime identity and attach initial profile metadata before the
user's first real request), but it must not be *required*, per the same "don't overengineer"
reasoning as §10.

### 11.3 Fully stateless resolution (no persistent record at all) — rejected

Runtime state (memory, threads, and — later — resource ownership if an external user creates their
own agents) needs a stable internal handle to attach to across requests. Some minimal persistent
resolution record is therefore necessary. It should remain **minimal** — an identity-resolution
anchor, not a full profile record (§12).

### 11.4 Lifecycle Edge Cases

- **Subsequent requests:** resolve to the same internal handle deterministically; no re-provisioning
  side effects.
- **Beyond Campus deletes Rahul:** Persona has no visibility into Beyond Campus's internal deletion
  unless Beyond Campus proactively signals it through some future capability (**OPEN** — a
  deprovisioning/webhook mechanism is plausible but is a Developer-API-surface design question,
  explicitly out of scope here, §22). Absent such a signal, Persona's runtime data for that compound
  key simply becomes dormant — this decision does **not** design automatic cascade deletion; the
  existing all-or-nothing Persona `userService.deleteUser()` cascade (synthesis §13, flagged there as
  incompatible with scoped deletion) is exactly the anti-pattern a future deprovisioning design must
  avoid repeating for external users. Recorded as a consequence (§21), not solved here.
- **Rahul's username/email changes but `externalUserId` stays the same:** nothing about identity or
  scoping changes. This is precisely *why* `externalUserId` must be a stable, opaque, host-controlled
  identifier rather than mutable profile data (§12) — the whole lifecycle model depends on this
  stability assumption.

---

## 12. Identity vs Profile Metadata

**DECISION: `externalUserId` alone is IDENTITY. Everything else (`displayName`, `email`, `avatar`,
etc.) is OPTIONAL, MUTABLE PROFILE METADATA and must never be used for authorization, scoping, or
lookup.**

| | IDENTITY | PROFILE METADATA |
|---|---|---|
| Field(s) | `externalUserId` only | `displayName`, `email`, `avatar`, etc. (illustrative — not an exhaustive or binding list) |
| Required? | Yes, on every runtime-user-scoped request | No — optional, may be omitted entirely |
| Mutability | Must be stable/immutable for the life of the account on the host side (§11.4) | Expected to change over time |
| Used for scoping/storage keys/authorization? | **Yes — exclusively** | **Never** |
| Who is authoritative | The Project (§4) | The Project, but Persona treats it as a soft display cache at best |
| Persistence expectation | A minimal internal runtime-identity anchor is kept (§11.1) | At most a latest-write-wins convenience value re-asserted per request; not treated as durable, authoritative Persona-owned profile data |

**Why this separation matters, precisely:** if email or username were ever used as part of a
scoping or lookup key, a mutable value would become a *de facto* security identifier — exactly the
failure mode the task brief warns against ("The architecture must not accidentally make mutable
email/name the security identity"). Requiring a stable, opaque, host-controlled `externalUserId` and
refusing to let anything else enter the identity computation is what prevents this. It also keeps
Persona's PII footprint minimal by design (data minimization), consistent with the product
requirement that external users should not need any Persona-managed account or profile in the first
place (§9 of the requirements document) — Persona should store the least identity-adjacent data
necessary to do its job, not accumulate a shadow profile store for every host product's users.

---

## 13. Request / Assertion Flow

```
Developer Backend (Project's server, already holds a valid Project credential)
        |
        |  same authenticated HTTPS request as Decision 01, PLUS:
        |  externalUserId = "rahul_123"          (illustrative field, wire location TBD)
        |  [optional] profile metadata            (never used for authorization — §12)
        v
Persona Project-Authentication Boundary          (Decision 01 — unchanged, runs FIRST)
        |
        |  on success: AuthenticatedProjectContext { projectIdentity, credentialIdentity }
        |  on failure: request rejected here — external-user assertion is NEVER evaluated (§19)
        v
Persona External-User Resolution Boundary        (this decision — runs SECOND, strictly after
        |                                          Project auth succeeds)
        |
        |  1. Read the asserted externalUserId from the (already-authenticated) request
        |  2. Pair it with the TRUSTED projectId from step above — never re-read projectId
        |     from anywhere else in the request (§15)
        |  3. Resolve-or-create the internal runtime-identity handle for
        |     (projectId, externalUserId)                                              (§11)
        |  4. [optional] soft-cache any supplied profile metadata for display purposes only
        v
AuthenticatedRuntimeContext { projectIdentity, credentialIdentity, externalUserIdentity }  (§14)
        v
Downstream: agent execution, thread/memory/MCP resolution, etc. (later decisions/architecture)
```

**DECISION:** `externalUserId` is **optional at the protocol level**, not mandatory on every
Project-authenticated request. Some calls are legitimately Project-level/control-plane operations
made by the Project itself (e.g., a future "list this Project's agents" call) with no runtime end
user behind them at all — for these, `externalUserIdentity` in the resulting context is simply
absent/null. Other calls are runtime/end-user-scoped (e.g., "Rahul sends a chat message") and
**must** carry a valid `externalUserId`, or the call should be rejected by whatever later API-surface
design enforces that requirement (out of scope here — recorded as a consequence, §21). This mirrors
the synthesis's control-plane-vs-runtime-identity distinction (synthesis §6) at the Project level,
the same way Decision 01 established it does not yet exist at the resource-ownership level.

---

## 14. Runtime Identity Context

Field names below are **illustrative only, not binding** — same convention as Decision 01.

```
AuthenticatedRuntimeContext {
    projectIdentity        // TRUSTED — carried forward unchanged from Decision 01
    credentialIdentity     // TRUSTED — carried forward unchanged from Decision 01
    externalUserIdentity   // present only when the request is runtime-user-scoped (§13);
                            // see labeling below — this is NOT simply "TRUSTED"
}
```

Precise trust labeling, because this is more subtle than Decision 01's (which had only trusted
values):

| Value | Label | Why |
|---|---|---|
| `projectIdentity` | **TRUSTED** | Unchanged from Decision 01 — cryptographically established, never caller-supplied |
| `credentialIdentity` | **TRUSTED** | Unchanged from Decision 01 |
| `externalUserId` (the raw asserted string) | **TRUSTED-AS-ASSERTED-BY-THE-PROJECT** — not independently verified by Persona | Persona accepts it at face value because the Project is the identity authority for its own users (§4). This is a *delegated* trust, not an independently-established fact — Persona is not claiming "this is really Rahul," only "the authenticated Beyond Campus backend says this is Rahul," which per §4 is sufficient and correct |
| The **compound pair** `(projectId, externalUserId)` | **DERIVED** | Constructed by Persona by pairing the two values above; this is the value actually used for all downstream scoping (§17). Its non-collision-across-Projects safety property is structurally guaranteed **regardless of** what string the Project asserts as `externalUserId`, because the `projectId` half can never be anything other than the authenticated Project's own identity (§15) |
| Any profile metadata (`displayName`, `email`, `avatar`, ...) | **UNTRUSTED for authorization purposes** | May be soft-cached for display only (§12); must never influence any scoping/authorization decision |
| Any `projectId` or `externalUserId` appearing **outside** an authenticated request (e.g. in an unrelated, unauthenticated call) | **UNTRUSTED, discarded** | No boundary in this architecture ever reads identity from an unauthenticated source |

---

## 15. Project Isolation Guarantees

**Core Question 3, answered directly: no, one Project cannot impersonate another Project's user,
and this is structurally impossible by construction, not merely policy.**

Beyond Campus's authenticated request can only ever produce a `projectIdentity` equal to Beyond
Campus's own (Decision 01's core guarantee, unmodified and reused here). Whatever `externalUserId`
string Beyond Campus asserts — even literally the string `"coursify-rahul"` or any value chosen to
look like it belongs elsewhere — the compound identity Persona derives is always
`(BeyondCampusProject, <whatever string was asserted>)`. **There is no code path in this design by
which the `projectId` half of the compound key can come from anywhere other than the Decision 01
credential lookup.** This is why `(BeyondCampus, rahul)` and `(Coursify, rahul)` can never collide
even though both may assert the identical `externalUserId` string "rahul": the second, silent
dimension of the key — `projectId` — is cryptographically fixed per request and never
attacker-influenceable.

**Core Question 4, answered directly: yes, a Project can assert *any* `externalUserId` string
within its own Project, including ones that don't correspond to a real user, and this is EXPECTED
AND CORRECT, not something Persona must cryptographically prevent.**

Reasoning: the Project **is** the identity authority for its own users (§4). Requiring Persona to
somehow verify "is this externalUserId a real Beyond Campus user" would require Persona to have
independent knowledge of Beyond Campus's user base — exactly the dependency the requirements
document explicitly rules out ("we do NOT want every Beyond Campus user to create a Persona
account"). This is directly analogous to how a trusted, API-key-authenticated backend service in
any multi-tenant SaaS platform is trusted to correctly represent its own internal operations; if
that backend is compromised or buggy, the platform cannot protect the tenant from its own compromise
— that risk is inherent to the delegation, not a gap in this design. It is the same trust shape as
a compromised e-commerce backend being able to create fraudulent orders using its own payment
processor API key: the processor doesn't (and structurally cannot) verify each order corresponds to
a real customer purchase — it trusts the authenticated merchant.

**This is a hard, explicit consequence of a leaked Project credential, and it must not be hidden:**
a leaked Beyond Campus credential doesn't just let an attacker act "as Beyond Campus" abstractly —
it lets them assert **any** externalUserId within Beyond Campus and thereby access/create runtime
state for any of Beyond Campus's (real or fabricated) users. This amplifies, but does not change the
category of, the blast radius Decision 01 already accepted for a leaked credential (Decision 01
§12.1) — it should be stated plainly as part of that risk's full scope, not treated as a new,
separate vulnerability.

---

## 16. MCP User-Auth Consequences

**Do not redesign MCP OAuth — establish the identity invariant it must consume, per task scope.**

**FACT** (synthesis §7, §12, re-confirmed in Decision 01 §5): Persona's MCP module already
distinguishes `authMode: 'owner'` (one shared credential for all runtime users) from
`authMode: 'user'` (each runtime user connects their own account, isolated via a compound key —
today `(mcpId, userId)`).

**DECISION (invariant, not a schema):** under the Developer Platform, the `authMode: 'user'`
compound key must become `(projectId, mcpId, externalUserId)` — i.e., Project-qualified in exactly
the same way every other runtime resource must be (§17). Concretely: Beyond Campus/Rahul's OAuth
connection to a given MCP-integrated service must be a completely distinct credential record from
Beyond Campus/Aman's connection to the same MCP, and both must be completely distinct from
Coursify/Rahul's connection — even if "Rahul" resolves to the identical `externalUserId` string in
both Projects. This directly extends the §15 non-collision guarantee into the MCP credential store,
which the synthesis flagged as one of the concrete places a bare `userId` key would otherwise
collide (synthesis §8, §15, §20 Hotspot #7).

**Where the existing signed-state precedent DOES remain the right tool, and why that's consistent
with §10's rejection of signing for the Project→Persona leg:** the MCP OAuth flow has a *second*
leg this decision has not touched — the redirect through the external OAuth provider and the
runtime user's own browser (§10 explains this is exactly the kind of untrusted-intermediary hop
that *does* need a signature). When a `authMode: 'user'` MCP connection is initiated on behalf of an
external (non-Clerk) user, the state payload signed at the start of that OAuth flow will need to
carry `(projectId, externalUserId)` instead of (or alongside) a bare Persona `userId` — reusing the
exact same HMAC-SHA256 + `timingSafeEqual` mechanism already proven in `oauth-state.js`, just with a
richer payload. **This is not a contradiction with §10's conclusion; it is the same reasoning
applied correctly to two different legs of two different flows** — signing is needed exactly where
an untrusted browser hop exists (the OAuth redirect leg) and not needed where it doesn't (the
Project-to-Persona API call leg).

---

## 17. Runtime-State Consequences

**Core invariant established by this decision (task-mandated, stated explicitly): runtime identity
must never be a bare `externalUserId`. It must always be Project-qualified as the compound pair
`(projectId, externalUserId)`.**

Building directly on the synthesis's Runtime State Isolation Matrix (synthesis §15) and Shared
Agent / Isolated Runtime finding (synthesis §8), every one of the following must be re-keyed to
include the `projectId` dimension this decision now makes available — **no schema is specified
here**, only the invariant each must satisfy:

| Resource | Today's key (bare, per synthesis) | Required future key (conceptual only) |
|---|---|---|
| Threads | `userId` | `(projectId, externalUserId)` |
| Checkpoints | `thread_id` only, no tenant field at all | must be reachable only via a thread already scoped to `(projectId, externalUserId)` — the storage-layer gap the synthesis flagged (§15, §20 Hotspot #9) is unchanged by this decision and remains a later runtime-architecture concern |
| Memory | `['users', userId, ...]` | `['projects', projectId, 'users', externalUserId, ...]` (illustrative shape only) |
| Files | none today | must be scoped by `(projectId, externalUserId)` where user-owned |
| MCP runtime-user credentials | `(mcpId, userId)` | `(projectId, mcpId, externalUserId)` (§16) |
| AgentFactory cache | `${cacheKey}:${userId}` | `${cacheKey}:${projectId}:${externalUserId}` (illustrative) |
| Rate limits | `concurrency:CHAT:${userId}` | `concurrency:CHAT:${projectId}:${externalUserId}` (illustrative) |

**Session/thread security — the known, previously-verified gap, restated and extended, not fixed
here:** the synthesis independently verified (synthesis §10, §21.1, §22.5) that today's AG-UI
thread-resumption path checks `thread.userId === userId` but never compares the thread's stored
`agentId` against the requested `x-agent-id`. **This decision does not fix that gap.** It does,
however, make explicit what the *later* runtime-isolation architecture must guarantee once
Project-qualification lands: thread resolution will need to verify **both** (a) that the requesting
`(projectId, externalUserId)` matches the thread's owner, qualified by the full compound key, not
merely a bare user field, **and** (b) that the thread's associated `agentId` is checked against the
requested agent — closing the existing gap **at the same time** the Project dimension is added,
since re-keying the ownership check is the natural point to also close it, not two separate future
efforts. This is recorded as a **requirement for that later decision** (§21), not resolved now.

---

## 18. Security / Threat Analysis

Threat-modeled against every item the task brief specified:

1. **Attacker with no valid Project credential supplying `externalUserId`** — Rejected before this
   layer even runs: Decision 01's boundary runs first and unconditionally (§13, §19); external-user
   resolution is never evaluated for a request that fails Project authentication.
2. **Project A attempting to access Project B's external user** — Structurally impossible; see §15's
   full reasoning. This is the central guarantee of this decision.
3. **Project backend asserting arbitrary user IDs inside its own Project** — Expected and correct by
   design, not a vulnerability; see §15's full reasoning. Explicitly not something this architecture
   attempts to cryptographically prevent, because doing so would contradict the Project's role as
   identity authority (§4).
4. **Leaked Project credential** — Inherits and amplifies Decision 01 §12.1's analysis: now
   explicitly includes "attacker can assert any `externalUserId` within that one Project," in
   addition to Decision 01's original scope. Same mitigations apply (immediate revocation, rotation
   without downtime, future audit logging by `credentialId`) — no new mitigation category is
   introduced by this decision, because no new credential type is introduced (§10).
5. **`externalUserId` collisions across Projects** — Explicitly a non-issue by design, because the
   compound key always includes the trusted `projectId` (§15) — directly resolves the specific
   cross-project collision risk the synthesis flagged (synthesis §8, §20 Hotspots #5–#8),
   **provided** every runtime layer actually implements the §17 invariant; this decision establishes
   the invariant, enforcing it everywhere is later implementation work.
6. **Mutable externalUser identifiers** — Addressed by requiring `externalUserId` to be a stable,
   opaque, host-controlled identifier (§12). **ASSUMPTION, stated as a requirement on Projects, not
   something Persona can enforce technically:** Projects must not recycle a retired `externalUserId`
   for a different real-world person. If a Project violates this, the new person would inherit the
   old person's runtime state — a risk that lives entirely on the Project's side of the trust
   boundary; Persona can only document the expectation, not cryptographically prevent the violation,
   consistent with §4's delegation model.
7. **Email used as identity** — Explicitly rejected; see §12. Email is profile metadata, never
   identity.
8. **Replay** — No new replay surface beyond what Decision 01 §12.3 already analyzed: the
   `externalUserId` assertion travels inside the same request as everything else, protected by the
   same TLS + credential guarantees; this decision introduces no separate, independently-replayable
   artifact (no token, no signature — §10).
9. **Tampering** — Covered by TLS's whole-request integrity guarantee (§10); no additional tampering
   surface is introduced by adding a plain field to an already-protected request.
10. **Forged user assertions** — A genuine forgery (as opposed to §3's expected within-Project
    assertion authority) would require either compromising the Project credential (covered by #4) or
    compromising TLS (an infrastructure-level assumption, out of scope for this decision). No other
    forgery vector exists in this design, because there is no separate signable artifact to forge.
11. **User deletion/deactivation** — No automated cross-system deprovisioning is designed here
    (§11.4); flagged **OPEN** and recorded as a consequence for a future Developer-API-surface
    decision (§21, §22).
12. **Confused-deputy behavior** — Prevented by the same rule that prevents #2: the compound identity
    is always constructed by pairing the TRUSTED `projectId` with the asserted `externalUserId`,
    never by trusting a caller-supplied `projectId` at any layer (§15, reusing Decision 01 §12.10's
    invariant unmodified). Additionally, **DECISION**: downstream code consuming
    `AuthenticatedRuntimeContext` must never accept a bare `externalUserId` without its paired
    `projectId` traveling with it — this extends Decision 01 §13's warning against conflating
    `req.user`-style identity carriers to this layer's context object as well.
13. **Project credential rotation** — No new consideration: because Decision 01 allows multiple
    simultaneously-valid credentials per Project, an `externalUserId` assertion made under credential
    A vs. credential B (both valid mid-rotation) resolves to the identical `projectId` and therefore
    the identical runtime identity. Rotation of the Project credential has zero effect on already-
    resolved external-user runtime identities — a clean property inherited directly from Decision
    01's design, not something this decision had to solve separately.
14. **External-user token rotation** — Not applicable; this decision introduces no separate
    external-user token or credential to rotate (§10). If a future evolution adopts Option D/F
    (§8, §20.4), that decision would need its own rotation story — explicitly deferred.

---

## 19. Interaction With Project Authentication

**DECISION:** This decision strictly layers on top of Decision 01 and modifies nothing about it.

- Project authentication (Decision 01) always runs **first**, unconditionally, on every request.
- External-user resolution (this decision) only ever executes **after** Project authentication has
  already succeeded — if Decision 01 rejects a request, external-user assertion is never read,
  parsed, or evaluated (fail-closed ordering).
- `AuthenticatedRuntimeContext` (§14) is additive to `AuthenticatedProjectContext` (Decision 01
  §14) — it carries `projectIdentity`/`credentialIdentity` forward unchanged and adds
  `externalUserIdentity` alongside them, never replacing or re-deriving the former.
- No requirement or guarantee established in Decision 01 (§10–14 there) is altered, weakened, or
  reinterpreted by this decision.

---

## 20. Rejected Alternatives

### 20.1 Option C — Project-signed external-user assertion

Rejected for the precise reason given in §10: the signature would be redundant with protections TLS
and the Decision 01 credential already provide for a single-hop, already-authenticated request. It
would also require the Project to manage an additional signing secret, adding integration burden
with no corresponding security gain — the same "don't add complexity that doesn't close a real gap"
reasoning Decision 01 applied to reject its own Option C (signed JWT client assertion, Decision 01
§15.2).

### 20.2 Option D — Short-lived Persona-issued user token

Rejected for v1: adds a mandatory extra round trip and token-freshness/caching burden before every
runtime call, for no security benefit within this decision's synchronous, single-hop topology (§10).
Its one genuine potential benefit — letting a Project safely delegate a scoped identity to a
*different, less-trusted* internal component without sharing its raw Project secret — is a real but
currently unstated requirement; noted as a possible future evolution (§21), not built now.

### 20.3 Option E — Project-generated JWT representing its user

Rejected for the same reasoning as Decision 01's rejection of asymmetric client-assertion
authentication (Decision 01 §15.2): real security value in a topology with an untrusted
intermediary or no live channel, but that is not this decision's topology (§10), and it imposes
meaningful key-management burden on every integrating developer for no corresponding benefit here.

### 20.4 Option F — Token-exchange / delegated-token pattern

Rejected for v1 as the formalized version of Option D's rejected reasoning; the delegation-to-a-
less-trusted-component benefit is real but speculative today. Explicitly not foreclosed — see §21
for how it could be layered on later without redesigning what this decision establishes, mirroring
how Decision 01 §15.3 left room for a future token-exchange hardening layer on top of Project
credentials.

### 20.5 Mandatory explicit user-registration step

Rejected in §11.2 — adds integration friction without a corresponding security or correctness
benefit given the Project's already-established identity authority (§4). Remains available as an
optional convenience API later.

---

## 21. Consequences for Later Architecture

Recorded as constraints, not designed here (per task scope):

- **For the ExternalUser/Project schema (later decision):** a minimal internal runtime-identity
  resolution record keyed by `(projectId, externalUserId)` is needed (§11.1) — its exact shape,
  storage location, and relationship to any future `ExternalUser` collection is not decided here.
- **For ownership polymorphism (later decision):** if external users are ever allowed to own
  resources (per requirements §12, user-owned agents/skills/etc.), ownership must be expressed in
  terms of the compound `(projectId, externalUserId)` identity established here, not a bare ID.
- **For the runtime-isolation architecture (later decision, extending synthesis §15/§17 above):**
  every storage key/namespace/cache-key/rate-limit-key enumerated in §17 must be re-keyed to the
  compound pair; the thread-resumption `agentId`-vs-`x-agent-id` gap (§17) should be closed **at
  the same time** that re-keying work happens, not as a separate later effort.
- **For MCP `authMode: 'user'` (later decision, extending synthesis §12/Decision 01's MCP
  evidence):** the OAuth signed-state payload for user-mode connections initiated by external users
  must carry `(projectId, externalUserId)`, reusing the existing HMAC-SHA256 signing mechanism for
  that specific (browser-redirect) leg only (§16).
- **For the Developer API surface (later decision):** must decide whether/how `externalUserId` is
  required vs. optional per endpoint (§13), the exact wire format/location of the assertion, and
  whether an optional explicit user-registration/deprovisioning API is offered (§11.2, §11.4, §18-#11).
- **For a future hardening evolution (optional, not required now):** Option D/F's delegated-token
  pattern (§20.2, §20.4) remains available to layer on top of this decision's model later, the same
  way Decision 01 §15.3 left room for an OAuth-style hardening layer on top of Project credentials,
  without requiring a redesign of the `(projectId, externalUserId)` identity model itself.
- **For billing/quotas (later, out of scope today):** the resolved `(projectId, externalUserId)`
  pair is a natural attribution key for future per-user or per-Project usage limits; not designed
  here.

---

## 22. Open Questions

Explicitly preserved, not silently decided:

1. Exact wire format/location of the `externalUserId` assertion (header vs. body; field naming) —
   implementation-phase detail, does not affect the trust model (§10).
2. Whether/when to offer an optional explicit user-registration or pre-provisioning API (§11.2) —
   possible future convenience, not required now.
3. Whether/how a Project can signal user deletion/deactivation to Persona, and what Persona should
   do with orphaned runtime state as a result (§11.4, §18-#11) — deferred to a future Developer-API
   or data-retention decision.
4. Whether/when the delegated-token hardening evolution (§20.2, §20.4, §21) becomes worth building —
   no current evidence justifies it, but not foreclosed.
5. Whether per-endpoint enforcement of "externalUserId required" vs. "Project-level, no user" is a
   Developer-API-surface decision or something this identity layer should validate generically —
   leaning toward the former, not decided here (§13, §21).
6. Exact mechanism (if any) for a Project to correct/re-provision a mis-asserted `externalUserId`
   after the fact (e.g., merging two accidentally-separate runtime identities) — not addressed by
   this decision; flagged for later operational/API design.

---

## 23. Implementation Constraints

Collected from §15–18 and §21 for visibility, still non-binding on exact implementation:

- `projectId` must be resolved exclusively from the Decision 01 authenticated credential context at
  every point this decision's boundary runs — never re-read from any request field, at this layer
  or any layer downstream that consumes `AuthenticatedRuntimeContext` (§15, §18-#12).
- No downstream code may treat a bare `externalUserId` as a safe scoping/lookup key on its own; the
  compound `(projectId, externalUserId)` pair is the only safe unit (§14, §17, §18-#5).
- External-user resolution must run strictly after, and only after, Project authentication succeeds
  (§19) — fail-closed ordering, no exceptions.
- Profile metadata (display name, email, avatar, etc.) must never enter any authorization check,
  storage key, namespace, or cache key (§12, §14).
- Any future re-keying of threads/memory/checkpoints/MCP-user-credentials/AgentFactory-cache/rate-
  limits to the compound identity should close the existing `thread.agentId`-vs-`x-agent-id` gap in
  the same effort, not as a separate follow-up (§17, §21).
- If a future user-mode MCP OAuth flow is initiated on behalf of an external user, its signed-state
  payload must carry the compound identity, reusing the existing `oauth-state.js` HMAC mechanism
  rather than inventing a new one (§16).

---

## 24. Evidence / References

| Claim | Source |
|---|---|
| Decision 01 established `AuthenticatedProjectContext` with trusted `projectIdentity`/`credentialIdentity`, and the invariant that `projectId` is never taken from caller input | `product-research/10-developer-platform/architecture/01-project-authentication.md` §1, §10, §14 — read in full this session |
| Requirements: Trust Model, external users should not need Persona accounts, Project is authoritative for its own users | `product-research/10-developer-platform/developer-platform-requirements.md` §9 |
| `authService.syncUser()` lazy resolve-or-create precedent | Synthesis §5, §13 (codebase-readiness-synthesis.md), consistent with direct code reads performed during the prior research phase |
| MCP OAuth signed-state mechanism and its untrusted-browser-redirect rationale | `agent-backend/src/modules/mcp/oauth-state.js` — re-examined directly in the Decision 01 research pass (HMAC-SHA256, `crypto.timingSafeEqual`, TTL-bounded `exp`) |
| `authMode: 'owner'` vs `authMode: 'user'` MCP distinction, `(mcpId, userId)` compound key | Synthesis §7, §12 |
| Bare-`userId` runtime state keys (threads, memory, checkpoints, AgentFactory cache, rate limiter) and their cross-project collision risk | Synthesis §8, §15, §20 (Hotspots #5–#9) |
| `thread.agentId` never compared against requested `x-agent-id` | Synthesis §10, §21.1, §22.5 — independently re-verified against live source in the synthesis phase, not merely cited |
| `req.user` conflates identity and authorization context; guidance against repeating that mistake for new identity types | Synthesis §6, §13, §18-C; Decision 01 §13 |
| Existing all-or-nothing `userService.deleteUser()` cascade, flagged as incompatible with scoped deletion | Synthesis §13 |

---

*This document decides the external-user identity assertion mechanism only. It establishes
`(projectId, externalUserId)` as the trusted-by-construction runtime identity boundary and hands a
minimal `AuthenticatedRuntimeContext` to later architecture. It explicitly defers all schema design,
ownership polymorphism, the Developer API surface, Developer Studio UX, SDK design, billing, and
quotas to later, separately-scoped decisions (§21 records the constraints it creates for each).*
