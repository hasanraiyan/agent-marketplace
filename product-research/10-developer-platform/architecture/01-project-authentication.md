# Architecture Decision 01 — Project Authentication

> **Status:** DECIDED (this document). Scope: Project (machine-to-machine) authentication ONLY.
> **Explicitly NOT decided here:** external-user assertion protocol, Project schema, ExternalUser
> schema, ownership schema, collection tenancy strategy, Developer REST endpoint design, Developer
> Studio UX, SDK API surface. Where this decision creates constraints on those areas, they are
> recorded as **consequences** (§16, §18), not designed.
> **Inputs:** `product-research/10-developer-platform/developer-platform-requirements.md`
> (product truth) and `product-research/10-developer-platform/05-codebase-readiness-synthesis.md`
> (codebase evidence).
> **Labels used throughout:** DECISION / FACT / EVIDENCE / ASSUMPTION / OPEN.

---

## 1. Decision

**DECISION:** Persona authenticates a Project backend using **opaque, high-entropy secret Project
API keys**, structured as a public **key ID** (safe to log, display, and index on) plus a private
**secret** segment (shown once at creation, stored only as a one-way hash thereafter). The key ID
enables O(1) credential lookup before any secret comparison; the secret is verified with a
constant-time hash comparison. A Project may hold multiple simultaneously-valid keys. No OAuth 2.0
token-issuance flow and no asymmetric signed-JWT client-assertion scheme is introduced at this
stage — both were evaluated and rejected as unjustified complexity for what Persona's requirements
actually need (§6–7). No browser-usable ("publishable") variant of this credential is introduced
(§11).

This mechanism establishes **Project identity only**. It produces a trusted `projectId` and a
trusted `credentialId`. It says nothing about which external end user, if any, is behind the
request — that is Architecture Decision 02 (§14).

---

## 2. Context

Persona's current product (`/dashboard`, `/studio`) is entirely Clerk-authenticated —
**FACT** (synthesis §5, §13, re-verified directly against `auth.middleware.js` /
`auth.service.js` in the prior research phase): every request resolves to exactly one principal
type, a Persona User, via a Clerk session JWT. There is no machine-to-machine authentication
primitive anywhere in the codebase today — **FACT**, confirmed by a direct repo-wide search
(synthesis §22.15) that found zero matches for API keys, service accounts, or client-credentials
infrastructure.

The Developer Platform direction (requirements §7–9) requires external products — Beyond Campus,
Coursify, OpenFounder, and future products, referred to as **Projects** — to call Persona's future
Developer API from their own trusted backends, without any Persona user or Clerk session in the
loop. Before anything else in the Developer Platform can be designed, Persona needs a way for a
Project's backend to prove *"I am Project X"* to Persona.

---

## 3. Requirements (Restated From Task Brief, Unweakened)

The mechanism must support: Project as the hard isolation boundary; server-to-server
authentication; multiple credentials per Project; revocation; rotation; secure storage; Project
identification without trusting arbitrary client input; future usage attribution; future rate
limiting; future audit logging; safe (non-scanning) key lookup; developer-friendly local
development; production use; no dependency on a Persona user's Clerk session. Browser/client-side
usability of the credential must be explicitly analyzed, not assumed either way.

---

## 4. Existing Persona Constraints (Evidence From the Synthesis)

| Constraint | Status | Evidence |
|---|---|---|
| Auth is Clerk-only, single principal type | **FACT** | Synthesis §5, §13; re-verified `auth.middleware.js`/`auth.service.js` |
| No M2M authentication primitive exists | **FACT** | Synthesis §13, §19-#5, §22.15 (direct repo-wide search, zero matches) |
| No Project primitive exists | **FACT** | Synthesis §19-#1, §22.15 |
| `req.user` conflates identity and authorization context | **FACT** | Synthesis §6, §13; this decision must not repeat that mistake for Project identity |
| AES-256-GCM reversible field-level encryption exists (`utils/encryption.js`) | **FACT** | Re-read directly this session — versioned key-rotation support (`DB_ENCRYPTION_KEYS`, `DB_ENCRYPTION_ACTIVE_KEY_ID`), AAD-bound ciphertext, used today for Provider API keys and MCP OAuth tokens (values Persona must later recover in plaintext to call out) |
| MCP OAuth signed-state is the only session-independent identity-assertion precedent | **FACT** | Re-read directly this session (`oauth-state.js`): HMAC-SHA256 over a JSON payload, `crypto.timingSafeEqual` verification, TTL-bounded expiry, base64url-encoded `payload.signature` wire format |
| Zero centralized authorization exists anywhere | **FACT** | Synthesis §6, §13 |

**Key implication drawn from these facts, not asserted independently:** the existing reversible
AES-256-GCM module is the right *pattern precedent* (versioned keys, rotation-friendly) but the
**wrong cryptographic primitive** for this specific need — see §9.3 for why storage must be
one-way (hashed), not reversible (encrypted), unlike Provider keys and MCP OAuth tokens.

---

## 5. Standards / Industry Patterns Considered

Researched, not assumed, per the "do not reinvent the wheel" project principle:

- **Opaque secret API keys** (Stripe secret keys, OpenAI/Anthropic API keys, GitHub Personal
  Access Tokens, Twilio Auth Tokens) — a long, random, high-entropy bearer string sent on every
  request over TLS. The dominant pattern for server-to-server developer platforms where the same
  organization operates both the "authorization" and "resource" side of the relationship.
- **Publishable + secret key pairs** (Stripe's `pk_*`/`sk_*` split) — a *browser-safe* public key
  used for client-side tokenization, paired with a server-only secret key for privileged
  operations. Exists specifically because Stripe.js runs in the payer's browser.
- **Service accounts with asymmetric keys** (Google Cloud service account JSON keys, GitHub App
  installation private keys) — the caller holds a private key and signs short-lived assertions;
  the platform verifies with the corresponding public key. The private key itself is never
  transmitted.
- **OAuth 2.0 Client Credentials Grant** (RFC 6749 §4.4) — the caller exchanges a long-lived
  `client_id`/`client_secret` for a short-lived bearer access token at a token endpoint; the
  bearer token (not the secret) is what's presented on subsequent API calls.
- **Signed JWT / private-key client assertion** (RFC 7523, used by Google service accounts, Apple
  App Store Connect API, some OAuth "private_key_jwt" client authentication methods) — the caller
  signs a short-lived JWT with a private key it holds; no shared secret ever crosses the wire.
- **Key ID + secret schemes** (AWS Access Key ID / Secret Access Key; effectively also how Stripe
  and GitHub structure their opaque keys internally — a public, indexable identifier segment plus
  a private, high-entropy secret segment) — this is not a fifth independent pattern so much as the
  **field-tested implementation detail** of how a well-built opaque-secret-key system (the first
  bullet above) avoids full-table scans and enables safe revocation/rotation per credential.

---

## 6. Options Considered

### A. Opaque secret Project API keys (structured: key ID + secret)

A long-lived, random, high-entropy secret string, structured so a public **key ID** segment
(unique, indexable, safe to log/display) precedes or is embedded alongside a private **secret**
segment (shown once, stored only hashed). Presented as a bearer credential on every request.

### B. OAuth 2.0 Client Credentials Grant

Project registers a `client_id`/`client_secret`. Its backend calls a Persona token endpoint to
exchange them for a short-lived (e.g. 1-hour) access token, which is then presented on subsequent
API calls until it expires, at which point the backend re-exchanges.

### C. Signed JWT / private-key client assertion

Project generates an asymmetric key pair; Persona stores/registers the public key. The Project's
backend signs a short-lived JWT assertion with its private key on (or shortly before) each request
or session; Persona verifies the signature with the stored public key. The private key never
crosses the wire.

### D. Hybrid — none genuinely justified for v1

A hybrid (e.g., "opaque secret key exchanged once per session for a short-lived bearer token,"
which is effectively B built on top of A) was considered and is discussed as a **future hardening
path**, not a v1 requirement — see §15.3. No hybrid earns inclusion as the *initial* decision: the
task instructs "do not choose something merely because it is common," and the evidence below shows
plain option A already satisfies every stated requirement without B's or C's added machinery.

---

## 7. Comparison Matrix

| Criterion | A. Opaque secret key (key ID + secret) | B. OAuth 2.0 Client Credentials | C. Signed JWT / client assertion |
|---|---|---|---|
| Security (secret-in-transit exposure) | Secret sent on every request (over TLS); mitigated by hashing at rest and short practical rotation | Long-lived secret sent only at token-exchange time; short-lived bearer token sent on requests (smaller exposure window per token, but the underlying secret still exists and is still bearer-style) | Strongest: private key never transmitted at all; only a short-lived signed assertion is sent |
| Implementation complexity | Low — verify-on-every-request against a hashed lookup; no token-issuance service, no expiry/refresh state machine | Medium–High — needs a token endpoint, token expiry/refresh handling, token storage/caching on the Project's side, introspection or local verification on Persona's side | High — needs asymmetric key generation/registration flow, JWT signing libraries on the Project's side, clock-skew handling, key-rotation UX for asymmetric keys |
| Developer experience | Excellent — matches the pattern every mainstream API-key-based SDK developer already knows (Stripe/OpenAI/Anthropic-style); works with a single env var | Worse for a first-generation platform — developers must implement/maintain token refresh logic, or rely on an SDK to hide it | Worst for a first-generation platform — requires generating and safely storing a private key, plus JWT-signing code, on day one |
| Revocation | Immediate — flip a status flag on the specific credential record, checked on every request | Immediate for future token issuance, but already-issued short-lived access tokens remain valid until their own expiry unless a token-blacklist/introspection layer is added | Immediate at the public-key-registration level; already-issued short-lived assertions are, like B, bounded only by their own short TTL |
| Rotation (avoids downtime) | Clean — create new credential, deploy, revoke old; multiple credentials valid simultaneously (§9) | Clean in principle (new client_secret can coexist), but adds the operational question of coordinating token-cache invalidation on the Project's side | Clean in principle (new key pair registered alongside old), but adds asymmetric key-management overhead the Project must handle correctly |
| Lookup efficiency | O(1) — public key ID is an indexed lookup; secret is compared only after the specific record is found (§9.3) | O(1) for the exchanged token if it's a random reference (opaque token), or O(1) verification if it's a self-contained signed token (JWT-style access token) — but this just relocates the same lookup problem into the token-issuance step | O(1) — public key is looked up by a key ID/issuer identifier before signature verification |
| Leakage blast radius | Bounded to that one credential/Project; hashed storage means a DB leak alone does not yield usable secrets (§9.3, §12.2) | A leaked long-lived client_secret is exactly as dangerous as a leaked opaque key in A; a leaked short-lived access token is less dangerous (expires soon) but is *also* bearer-style, so it inherits A's transit-exposure risk during its lifetime | Smallest — a leaked short-lived assertion is only useful until it expires (typically minutes), and the private key (the actual long-lived secret) is never transmitted, so network/log interception cannot leak it at all |
| Browser safety | Not browser-safe by design; no variant is proposed for browser use (§11) | Not browser-safe (client_secret must never be in a browser) | Not browser-safe (private key must never be in a browser) — same conclusion as A and B for this specific use case |
| Observability | Straightforward — every authenticated request carries a stable, loggable key ID | Requires correlating token-issuance events with later API calls made using the issued token — an extra join | Straightforward — every request carries a loggable key/issuer ID via the assertion's claims |
| Future extensibility (scopes, environments, quotas) | Good — the credential record is a natural place to hang scopes/environment/quota metadata later (§9.6) | Good — OAuth scopes are a first-class concept in the standard, arguably the most "native" fit for scopes specifically | Good — JWT claims are a natural place for scopes, but this is true independent of the transport question |
| Compatibility with external-user assertion (Decision 02) | Clean separation — this layer only proves Project identity; the next layer can build on top of the trusted `projectId` however it needs to, unconstrained by this choice | Same — orthogonal to this decision | Same — orthogonal to this decision |
| Compatibility with SDKs | Excellent — "put this key in an env var" is the simplest possible SDK contract | Worse — SDK must implement or wrap token refresh logic to hide the complexity from the developer | Worst — SDK must implement JWT signing and key management, a much heavier client-side dependency |
| Compatibility with existing Persona infrastructure | High — Node `crypto` primitives already used identically for MCP OAuth state signing (`timingSafeEqual`, HMAC); pairs naturally with the existing "never log secrets" convention (`AGENTS.md`) | Low — Persona has zero OAuth *resource-server*/token-issuance code today (only OAuth *client* code, for connecting to external MCP servers); would be new infrastructure from scratch | Low — Persona has no asymmetric key-management or JWT-verification infrastructure today |

---

## 8. Selected Model

**DECISION: Option A — opaque, structured (key ID + secret) Project API keys.**

**Why it wins, weighed against Persona's actual requirements rather than general popularity:**

1. Every stated requirement (§3) is satisfiable with Option A alone: multiple credentials per
   Project, revocation, rotation without downtime, secure (hashed) storage, O(1) safe lookup,
   future usage attribution/rate limiting/audit (all hang off the stable key ID), no Clerk
   dependency, and excellent local-dev/production DX (a single environment variable).
2. Option B's core advantage over A — bounding the lifetime of the bearer credential actually sent
   on the wire — is a real security property, but it requires Persona to stand up a token-issuance
   and expiry/refresh subsystem that does not exist today (EVIDENCE: synthesis §13, §19-#5) purely
   to shrink an exposure window that TLS + rotation + hashed storage already substantially
   mitigate. This is exactly the kind of complexity the task brief warns against choosing "merely
   because it is common" among enterprise IDaaS platforms — those platforms typically need OAuth
   because they are a *generic* authorization server in front of *many different, independently
   operated* resource servers. Persona is not that: it is both the authorization and resource
   authority for its own Developer API, matching the profile of Stripe/OpenAI/Anthropic (all of
   which use plain opaque secret keys for exactly this reason), not the profile of Auth0/Okta.
3. Option C offers the strongest theoretical security (the secret never transits the network at
   all) but imposes real key-management burden on every developer integrating with Persona on day
   one, for a marginal improvement over A given TLS is already assumed as an infrastructure-level
   guarantee. This is the right model for high-trust, high-friction-tolerant integrations
   (Google Cloud, Apple), not for a platform trying to make integration approachable.
4. A does not foreclose B or C later. Because A's authentication boundary is a clean middleware
   layer producing a trusted `projectId`/`credentialId` (§13–14), a future short-lived-token
   exchange (B) could be layered *on top of* A's credential store without redesigning it — the
   long-lived secret would simply become "the thing you exchange for a token" instead of "the
   thing you send directly." This is noted as a future hardening path (§15.3), not a present
   requirement.

---

## 9. Credential Lifecycle

Conceptual only — no database schema is specified (per task constraint).

### 9.1 Create

**DECISION:** A new credential is generated as two parts:
- a **public key ID** — unique, random (not sequential, to avoid enumeration, §12.5), safe to
  display, log, and index on forever.
- a **private secret** — separately random, high-entropy (ASSUMPTION: ≥256 bits of randomness is
  an appropriate target; the exact byte length/encoding is an implementation-phase detail, not
  decided here).

**ILLUSTRATIVE ONLY, not binding:** a credential might look like `pk_live_9f2...` for the key-ID
portion and be combined with a secret portion into a single presented string, similar in spirit to
how Stripe/GitHub-style keys are structured. The exact wire format (single concatenated string vs.
two separate values, prefix conventions for environment/version) is explicitly left to the
implementation phase.

### 9.2 Display

**DECISION:** The full secret is shown to the developer **exactly once**, at creation time. After
that moment, Persona never stores and can never redisplay the plaintext secret. Only the key ID and
non-secret metadata (creation date, label, last-used timestamp) remain retrievable. This is the
same "shown once" convention used by Stripe, GitHub, and AWS, chosen specifically because it means
a later compromise of an admin session/UI cannot retroactively exfiltrate a previously-issued
secret — there is nothing left to steal from Persona's side.

### 9.3 Store

**DECISION: Store a one-way hash of the secret, not a reversible encryption of it.**

This deliberately diverges from the existing `utils/encryption.js` pattern used for Provider API
keys and MCP OAuth tokens. Those values must be recovered in **plaintext** later so Persona can
present them to an external service (OpenAI, a user's Google account, etc.) — reversible AES-256-GCM
is correct there. A Project's authentication secret is different: Persona only ever needs to verify
that a *presented* secret matches, never to reconstruct or re-present it to anyone. One-way hashing
(e.g., a keyed hash such as HMAC-SHA256 with a server-side pepper, or a modern password-hash
function — the exact algorithm is an implementation-phase choice, not decided here) is strictly
more secure for this specific case: a full database leak reveals nothing usable about the secret
itself (§12.2), whereas a reversible scheme's security reduces to "the encryption key was not also
leaked." **This is the single most important divergence from existing Persona crypto conventions
that this decision introduces, and it is intentional** — see §18 for the implementation-phase
consequence this creates (a new one-way hashing utility is needed; the existing `encryption.js`
module is the wrong primitive to reuse directly here, though its conventions — versioned format,
key-rotation via a keyring, never storing plaintext — are worth mirroring in spirit).

### 9.4 Authenticate

See §10 for the full flow. Summary: extract key ID from the presented credential → O(1) lookup of
the credential record → check not-revoked/not-expired → hash the presented secret and compare
(constant-time) against the stored hash → on match, resolve `projectId` from the **credential
record**, never from any caller-supplied value.

### 9.5 Rotate

**DECISION:** Rotation never requires a zero-credential window. The developer creates a new
credential (new key ID + secret) while the old one remains fully valid, deploys the new credential
to their backend, confirms it works, then revokes the old one. A Project can hold multiple
simultaneously-active credentials at any time (directly satisfying "multiple credentials per
Project if useful" from §3) — this is what makes downtime-free rotation possible; it is not an
optional nicety layered on top.

### 9.6 Revoke

**DECISION:** Revocation is per-credential (by key ID), not per-Project — revoking one credential
must not invalidate a Project's other active credentials. Immediately after revocation, the next
authentication attempt using that credential must fail (§12.8 discusses the caching caveat: since
no caching layer for this check exists yet, "immediately" means "on the very next request" by
default; introducing a cache later is a consequence for the implementation phase to weigh, not a
decision made here).

### 9.7 Audit

**DECISION (conceptual only):** Every authentication attempt — success or failure — is a natural
point to record `credentialId` (never the raw secret) for future usage attribution, rate limiting,
and audit logging, satisfying three of §3's stated requirements simultaneously without any of them
being designed in detail here (no schema, no log format, no retention policy).

### 9.8 Scopes

**DECISION:** Credentials are **not** scoped in this decision — v1 authenticates "this is Project
X," full stop. However, the credential record's conceptual shape must not preclude adding scopes
later (e.g., a future `scopes`/`permissions` field). This is a **design-space reservation**, not an
implementation: nothing here should be built in a way that hardcodes "one credential = unscoped
full access" so deeply that scopes become a breaking change later. Concrete scope semantics are
explicitly deferred to whenever the Developer API surface itself is designed, since scopes without
an API surface to scope against are meaningless.

---

## 10. Authentication Flow

```
Developer Backend (Project's server)
        |
        |  presents Project credential (e.g. Authorization: Bearer <credential>,
        |  or a dedicated header — exact transport TBD in implementation phase)
        v
Persona Project-Authentication Boundary   (a NEW middleware, parallel to — not
        |                                  reusing — the existing Clerk authMiddleware)
        |
        |  1. Parse credential → extract public key-ID segment
        |  2. O(1) lookup: find the credential record by key ID
        |  3. Reject if: not found / revoked / expired
        |  4. Hash the presented secret; constant-time compare to the stored hash
        |  5. On success: resolve `projectId` FROM THE CREDENTIAL RECORD
        v
AuthenticatedProjectContext { projectIdentity, credentialIdentity, ... }   (§14)
        v
Developer Platform (next layer: external-user assertion — Decision 02;
                     then resource resolution — later decisions)
```

This mirrors the shape of the existing `authMiddleware` (Clerk JWT → `syncUser` → `req.user`)
without reusing its code path — see §13 for why they must remain structurally separate.

---

## 11. Browser/Client-Side Use — Explicit Analysis

**DECISION: Project credentials must never be usable from a browser context. No
"publishable"/public variant of this credential is introduced at this stage.**

Reasoning, evaluated directly against Persona's actual requirements rather than copying Stripe's
model wholesale:

- Stripe's publishable/secret key split exists because **Stripe.js runs inside the payer's
  browser** and needs to tokenize card data client-side before it ever reaches the merchant's
  server. Persona's Developer Platform has no analogous requirement: per the requirements
  document's "Host Application Responsibilities" (§25) and "Headless Agent Platform" direction
  (§24), a Project's own **backend** is the trusted intermediary between its end users and Persona
  — the Project's end-user browsers talk to the *Project's* backend, never directly to Persona's
  Developer API. There is currently no product requirement for anything to call Persona's
  Developer API from a browser at all.
- Introducing a browser-safe credential variant now would be designing a capability nobody has
  asked for, ahead of the Developer API surface that would need to justify it (out of scope for
  this decision, per the task brief).
- **OPEN (flagged, not resolved):** if a future product direction introduces a client-side
  embeddable widget (e.g., a Persona-hosted chat widget a Project drops into its own frontend),
  that would need its own **purpose-built**, short-lived, narrowly-scoped browser-safe token —
  minted by the Project's *backend* using its Project credential and handed to its own browser
  client, analogous to how Stripe issues short-lived client secrets for specific payment intents
  rather than exposing the merchant's actual secret key. This is explicitly **not** a variant of
  the Project credential itself and is left for a future decision if and when that product need
  materializes.

---

## 12. Security Analysis

Threat-modeled against every item the task brief specified, using DECISION-level design choices
made above as the mitigation basis in each case.

1. **Leaked Project secret** — Attacker can authenticate as that one Project only; cross-Project
   and cross-Persona-product isolation both hold (this credential type has no path into Clerk-
   authenticated Persona routes, §13). Blast radius is bounded to whatever the Developer API
   permits a Project to do (undesigned as of this decision) and to that Project's own data.
   Mitigation: immediate revocation (§9.6), rotation without downtime (§9.5) so a suspected leak
   can be remediated without an outage, and future audit logging by `credentialId` (§9.7) to
   detect anomalous use.
2. **Credential database leak** — Because secrets are stored **hashed, not encrypted** (§9.3), a
   full DB leak does not by itself yield usable secrets; an attacker would need to brute-force
   high-entropy random values, which is infeasible (unlike password hashes, these secrets have no
   dictionary to attack). This is the primary reason hashing was chosen over reuse of the existing
   reversible `encryption.js` pattern.
3. **Replay** — A captured request (e.g., via a compromised log pipeline or a downstream proxy)
   could in principle be replayed since v1 uses a static bearer secret over TLS, not a per-request
   signature/nonce. Mitigated by: TLS as a baseline infrastructure assumption (not re-litigated
   here), an explicit constraint that raw secrets must never be logged anywhere (§12.6), and
   rotation limiting the exposure window if a leak is suspected. **OPEN:** whether v1 needs replay
   protection beyond TLS (e.g., request signing) — flagged as unlikely to be necessary given the
   above, revisit only if evidence emerges.
4. **Brute-force guessing** — Mitigated by requiring high secret entropy (ASSUMPTION §9.1) and by
   rate-limiting authentication *attempts* themselves (per key ID and/or per source IP), not just
   post-authentication API usage — an explicit implementation constraint (§18).
5. **Credential enumeration** — Key IDs must be randomly generated (not sequential/guessable), and
   the authentication boundary must return an identical response (status code, body shape, and
   comparable timing) for "key ID not found" and "key ID found but secret mismatch" — otherwise an
   attacker can distinguish valid key IDs from invalid ones. Explicit implementation constraint
   (§18).
6. **Log leakage** — Raw secrets must never appear in logs, error messages, or stack traces; only
   the public key ID may be logged. This directly mirrors an existing, already-enforced Persona
   convention (`AGENTS.md` Security Rules: "Never log secrets, API keys, tokens — use `maskedKey`
   patterns"), so this is a continuation of existing practice, not a new one.
7. **Accidental frontend exposure** — Closed by design: there is no browser-safe variant of this
   credential to accidentally expose (§11). Nothing about this credential type is safe to ship to
   a browser under any circumstance.
8. **Revoked credential reuse** — The authentication check must consult the live credential-record
   status. No caching layer for this specific check exists today, so the default posture is
   "always check live." If a future performance need introduces caching, its TTL must be bounded
   tightly enough that the post-revocation exposure window remains acceptable — flagged as an
   implementation-phase consequence (§18), not decided now.
9. **Rotation race conditions** — Structurally avoided: because multiple credentials can be valid
   simultaneously (§9.5–9.6), rotation is always create-new → verify → revoke-old, never a single
   atomic swap. There is no window where a Project has zero valid credentials.
10. **Attacker supplying another Project's `projectId`** — Structurally impossible by design: the
    authentication boundary never reads `projectId` from caller-supplied input (header, query,
    body). It is always resolved from the DB record matched by the authenticated credential's key
    ID (§13). This directly satisfies the task's explicit critical requirement.
11. **Timing attacks** — Secret comparison must use a constant-time comparison
    (`crypto.timingSafeEqual`, already precedented in this exact codebase's `oauth-state.js`
    signature verification, re-read directly this session). The "key ID not found" path should
    take comparable time to the "found, secret mismatch" path (e.g., by still performing a dummy
    hash comparison on a not-found lookup) to avoid a timing oracle revealing which key IDs exist.
    Explicit implementation constraint (§18).
12. **Confused-deputy behavior between Clerk and Project authentication** — Prevented structurally
    by keeping the two authentication boundaries entirely separate (§13): a Clerk-authenticated
    request populates `req.user` and nothing else; a Project-authenticated request populates a
    distinct context object and nothing else. Downstream code must check *which* boundary
    authenticated a request, not merely whether some identity object is truthy. This directly
    honors the synthesis's warning (§6/§13/§18-C) against extending `req.user` to carry Project
    identity.

---

## 13. Clerk Coexistence

**DECISION:** Project authentication is implemented as a structurally **separate** middleware and
request-context boundary from the existing Clerk pipeline — it does **not** extend, wrap, or
reuse `req.user`.

**FACT, re-confirmed from the synthesis (§13):** `req.user` today conflates authentication ("who
is calling") and authorization context ("what do they own") into one object, and every downstream
service reads `req.user.id` for both purposes. Extending that same object with Project fields would
recreate exactly the conflation the synthesis flagged as a design hazard — a service that
carelessly reads `req.user.id` off a Project-authenticated request would silently misinterpret a
`credentialId` as if it were a Persona User's MongoDB ObjectId, or vice versa.

Instead, the two boundaries coexist as **independent middleware chains mounted on independent
route surfaces**, exactly the way the current codebase already runs four distinct auth postures
side by side without conflict (**FACT**, re-confirmed directly this session and in the synthesis):
required Clerk auth (`authMiddleware`), optional Clerk auth (`optionalAuthMiddleware`), Clerk auth
plus a role check (`adminMiddleware`), and no auth at all with raw-body handling (the Clerk webhook
route). A fifth posture — Project-credential authentication, populating its own context object
(illustrative name: `req.projectContext`, not binding) — is additive to this existing pattern, not
a departure from it.

**Explicitly NOT decided here (per task scope):** whether Persona's own product is later modeled
as "Project: Persona" (synthesis §25, Tier 1 question 3). This decision only establishes that the
auth boundary is *capable* of distinguishing a Persona User request from a Developer Project
request today, by construction (different middleware populated different, non-overlapping context),
without prejudging whether they are unified into one principal model later.

---

## 14. Contract Exposed to External-User Identity Layer

The next architecture decision (external-user assertion) can rely on the following guarantees
without re-deriving them. Field names below are **illustrative only, not binding**:

```
AuthenticatedProjectContext {
    projectIdentity      // TRUSTED — resolved from the credential record via DB lookup;
                          // never taken from any caller-supplied header/query/body value
    credentialIdentity   // TRUSTED — which specific credential (key ID) authenticated this
                          // request; useful for audit, rate limiting, and scoped revocation
}
```

**Guarantee provided to Decision 02:** by the time a request reaches the external-user-assertion
layer, it has already been proven to belong to exactly one specific, non-revoked Project
credential, and the `projectId` available to that layer is trustworthy and was never taken from
unauthenticated caller input. Decision 02's job is then *only* to determine, within this
already-trusted Project, which external user (if any) is behind the request. It must not, and per
this contract does not need to, re-derive or re-trust `projectId` from anywhere else.

**Explicitly not guaranteed by this layer:** anything about an external user. A valid Project
credential proves "which application is calling," not "which end user, if any, is behind this
specific call" — that is a deliberately separate question left entirely to Decision 02, including
whatever trust model it adopts (e.g., "a Project backend that has already authenticated its own
user is trusted to assert that user's identity to Persona" is a plausible direction, but it is a
**decision for that phase**, not this one).

---

## 15. Rejected Alternatives

### 15.1 Option B — OAuth 2.0 Client Credentials Grant

Rejected for v1. Not because it's a bad pattern in general — it is the *correct* pattern when an
authorization server serves many independently-operated resource servers, or when OAuth-ecosystem
interoperability (API gateways, third-party OAuth tooling) is itself a requirement. Neither
condition holds for Persona today: Persona is both the authorization and resource authority for
its own Developer API. Adopting it would mean building a token-issuance/expiry/refresh subsystem
from scratch (**FACT**: zero such infrastructure exists today, synthesis §13/§19-#5) to gain a
security property (bounded bearer-token lifetime) that TLS + hashed storage + rotation already
substantially cover for a v1. See §8 for the full reasoning and §15.3 for how B remains available
as a future layer on top of A without redesign.

### 15.2 Option C — Signed JWT / private-key client assertion

Rejected for v1. Offers the strongest theoretical security (no secret ever transits the network),
but imposes real asymmetric-key-management burden on every integrating developer from day one, for
a marginal improvement given TLS is already an infrastructure-level assumption. This is the right
model for high-trust, high-friction-tolerant integrations (Google Cloud service accounts, Apple
App Store Connect), not for a platform explicitly trying to make integration approachable
(requirements' "developer-friendly local development" criterion, §3).

### 15.3 Hybrid (Option D) — token exchange layered on top of A

Not adopted now, but explicitly not foreclosed. A future hardening path exists where a Project
still holds a long-lived opaque secret (as decided, §9) but exchanges it for a short-lived bearer
token before making API calls — effectively Option B built on top of Option A's credential store,
narrowing daily exposure without a full OAuth-ecosystem rebuild. This is recorded as a **possible
future evolution**, not a present requirement, because nothing in today's requirements or evidence
justifies its added complexity yet (§3 lists no requirement this would satisfy that A does not
already satisfy).

### 15.4 Publishable/browser-safe key variant

Rejected for v1 — see full reasoning in §11. No product requirement exists for browser-side calls
to Persona's Developer API; introducing this now would be speculative.

### 15.5 Naive unstructured opaque secret (no key ID segment)

Rejected as a sub-variant of A. Without a public, indexable key-ID segment, authenticating a
request would require either (a) a full-table hash comparison against every stored credential
(unsafe lookup — directly violates the "safe key lookup" requirement, §3) or (b) reversibly
encrypting the whole credential for lookup, which reintroduces the exact plaintext-recoverability
risk that hashing (§9.3) is specifically chosen to avoid. The structured key-ID + secret variant
is the field-tested resolution of this exact tension (§5, last bullet) and is what "Option A" means
throughout this document.

---

## 16. Consequences

Recorded as constraints for later phases, not designed here (per task scope):

- **For ownership/schema design (later decision):** a `Project` entity/record must exist for
  credentials to belong to and for `projectId` to resolve against — this decision assumes such a
  resolvable identity exists but does not design its shape.
- **For the Developer API surface (later decision):** every future Developer API endpoint must be
  mounted behind the Project-authentication boundary described here (§10, §13), on a route surface
  structurally separate from existing Clerk-authenticated routes.
- **For external-user assertion (Decision 02, next):** must consume the `AuthenticatedProjectContext`
  contract in §14 as its starting trust basis, and must not re-derive `projectId` from any other
  source.
- **For crypto/infrastructure (implementation phase):** a **new one-way hashing utility** is needed
  for credential secrets; the existing `utils/encryption.js` (reversible AES-256-GCM) is the wrong
  primitive to reuse directly for this purpose, though its *conventions* (versioned format, keyring
  with an active-key-ID for rotation, never storing bare plaintext) are worth mirroring for a
  server-side pepper if one is used.
- **For rate limiting (later, out of scope today):** the existing rate-limiter pattern
  (`concurrency:CHAT:${userId}`-style keys, synthesis §15) is a reusable *shape* for a future
  `credentialId`-scoped rate limit, but Project-scoped rate limiting itself is not designed here.
- **For audit logging (later, out of scope today):** `credentialId` is the natural attribution key
  for future audit/usage logs; no log schema is specified here.
- **For Developer Studio (later, out of scope today):** credential create/display/rotate/revoke
  (§9) implies Developer Studio will need UI for exactly those five actions; no UX is designed
  here.

---

## 17. Open Questions

Explicitly preserved, not silently decided:

1. Exact wire format of the credential (single concatenated string vs. two header values; prefix
   conventions for environment such as test/live) — implementation-phase detail.
2. Exact hashing algorithm/parameters for secret storage (keyed HMAC vs. a password-hash function;
   pepper management) — implementation-phase detail, informed by §9.3's requirement that it be
   one-way.
3. Exact secret length/entropy target — ASSUMPTION of ≥256 bits stated in §9.1, not finalized.
4. Whether v1 needs replay protection beyond TLS (request signing/nonces) — flagged §12.3, leaning
   "not needed yet" but not closed.
5. Whether/when a future short-lived-token-exchange hardening layer (§15.3) becomes worth building.
6. Whether/when a purpose-built browser-safe token mechanism (§11) becomes worth building, if a
   client-side embeddable-widget product direction emerges.
7. Whether Persona itself is later modeled as a Project (explicitly deferred to synthesis §25 Tier
   1, question 3 — this decision does not depend on nor answer it, per §13).
8. Exact transport convention (Authorization: Bearer vs. a dedicated header) — implementation-phase
   detail; either is compatible with everything decided here.
9. Whether per-credential expiration (as opposed to only manual revocation) is needed for v1, or
   whether credentials are valid until explicitly revoked — not decided here.

---

## 18. Implementation Constraints for Later Phases

Collected from §12 and §16 for visibility, still non-binding on exact implementation:

- Never log, echo, or include the raw secret anywhere after the one-time display at creation
  (§9.2, §12.6) — extends the existing `maskedKey` convention (`AGENTS.md`) to this new credential
  type.
- Constant-time comparison for secret verification; comparable-time handling of "not found" vs.
  "found, mismatch" paths to avoid a timing oracle (§12.5, §12.11).
- Rate-limit authentication *attempts* themselves, not only post-auth API usage (§12.4).
- `projectId` must only ever be resolved via the authenticated credential's DB record — never
  accepted from caller-supplied input at this layer, under any circumstance (§12.10, §14).
- The Project-authentication boundary must populate a context object structurally distinct from
  `req.user`, and downstream code must be able to tell which boundary authenticated a given request
  (§12.12, §13).
- New one-way hashing utility required; do not repurpose the existing reversible
  `utils/encryption.js` for credential-secret storage (§9.3, §16).

---

## 19. Evidence / References

| Claim | Source |
|---|---|
| Auth is Clerk-only today, single principal type | `product-research/10-developer-platform/05-codebase-readiness-synthesis.md` §5, §13; re-verified `agent-backend/src/modules/auth/auth.middleware.js`, `auth.service.js` in prior research phase |
| No M2M auth primitive, no Project primitive exist | Synthesis §13, §19; direct repo-wide search performed in the prior research phase, re-confirmed via reasoning here (§4), zero matches for API-key/service-account/client-credentials infrastructure |
| `req.user` conflates identity and authorization | Synthesis §6, §13, §18-C |
| AES-256-GCM reversible encryption with key rotation | `agent-backend/src/utils/encryption.js` — read directly in full this session (versioned token format `enc:v1:<keyId>:<iv>:<tag>:<ciphertext>`, AAD-bound to the key-ID header, `DB_ENCRYPTION_KEYS`/`DB_ENCRYPTION_ACTIVE_KEY_ID` keyring, fail-closed in production) |
| MCP OAuth signed-state precedent | `agent-backend/src/modules/mcp/oauth-state.js` — read directly in full this session (`crypto.createHmac('sha256', ...)`, `crypto.timingSafeEqual` verification, TTL-bounded `exp` claim, base64url `payload.signature` format) |
| Four existing coexisting auth postures (required/optional/admin/none) | Synthesis §4, §13; re-confirmed in reasoning here (§13) |
| "Never log secrets ... use maskedKey patterns" convention | `AGENTS.md` — Security Rules |
| Requirements: Project as hard isolation boundary, external users authenticated by host products, Host Application responsibilities | `product-research/10-developer-platform/developer-platform-requirements.md` §6–9, §25 |

---

*This document decides Project (machine-to-machine) authentication only. It creates a trusted
`projectId`/`credentialId` context for the next architecture decision to build on, and explicitly
defers external-user assertion, all schema design, the Developer API surface, Developer Studio UX,
and SDK design to later, separately-scoped decisions (§16 records the constraints it creates for
each).*
