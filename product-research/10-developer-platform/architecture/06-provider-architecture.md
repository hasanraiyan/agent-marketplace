# Architecture Decision 06 — Provider Architecture

> **Status:** DECIDED (this document). Scope: Provider ownership, credential authority, runtime
> resolution, and Project-level provider behavior — the deliberately-deferred resource from AD-04
> §17 and AD-05 §18. Starts strictly after AD-01–AD-05 — none is reopened.
> **Explicitly NOT decided here:** exact MongoDB schema, encryption implementation changes, exact
> Project/RBAC schema, API endpoint paths/payloads, Developer Studio UI, SDK methods, pricing,
> billing implementation, quota algorithms, model-routing/load-balancing systems, cross-Domain
> Provider sharing, external-user BYOK.
> **Inputs:** requirements, synthesis, `architecture/01–05-*.md`, and **fresh source reads
> performed for this decision** (§4).
> **Labels used throughout:** DECISION / FACT / EVIDENCE / ASSUMPTION / OPEN.

---

## 1. Decision

**DECISION:** Provider remains a single, combined record — vendor endpoint + encrypted credential +
default-model configuration bundled together, exactly as today (§5) — not decomposed into separate
vendor/credential/model abstractions the evidence doesn't support. Ownership follows AD-04
(`OwnerType ∈ {PersonaUser, Project}`), extended here with a third, narrowly-scoped, **evidence-
confirmed** category: **Platform/Internal Provider**, used exclusively for Persona's own internal
infrastructure needs, never selectable by any Agent (§18).

**Agent-level selection is Option B, generalized**: an Agent may explicitly reference a Provider +
model; if it doesn't, resolution falls through to a **Project-level default** (new capability) or,
for Persona specifically, today's existing Architect-only default-resolution behavior (preserved,
unchanged, §14). Absent any of these, resolution **fails closed** with an explicit, explainable
error — no arbitrary "first found" fallback is introduced for Projects (§15).

**Provider usage is architecturally independent of Provider ownership.** An external-user-owned
Agent may reference its Project's own Provider without gaining ownership, administrative authority,
or — critically — **any plaintext access to the credential, ever, under any circumstance, for any
principal**, matching and formalizing an already-correct property of the current implementation
(§16).

**No automatic runtime failover exists.** A Provider that fails at execution time (invalid
credential, vendor outage, deleted, disabled) fails the request explicitly. Configuration fallback
(Agent → Project default → [Persona: Architect legacy resolution] → fail closed) is a deterministic,
decided-in-advance resolution chain — a different concept from failover, kept explicitly separate
per the task's instruction (§15, §21).

---

## 2. Context

AD-04 decided Provider's ownership *taxonomy* only (`PersonaUser`, `Project` — not `ExternalUser`)
and explicitly deferred everything else. AD-05 decided Provider's *persistence isolation* only
(Domain-qualified lookup, no special exemption from the universal rule). Neither decided how an
Agent actually finds its effective Provider, what happens when configuration is incomplete or a
credential fails, or where the line sits between "administers the Provider" and "can see the
secret." This decision resolves all of that — sufficiently for the Developer API/runtime
architecture to be designed next, and no further.

---

## 3. Requirements / Inherited Invariants

From AD-01–AD-05, reused without modification: Domain is the hard isolation boundary (AD-03);
Provider is Domain-scoped, `OwnerType ∈ {PersonaUser, Project}`, ExternalUser ownership not required
(AD-04); ownership ≠ creator ≠ authority ≠ runtime actor (AD-04); Provider lookups are always
Domain-qualified, never bare-ID (AD-05); missing Domain context is an error (AD-05). From the task
brief, restated and treated as binding for this decision specifically: Provider ownership ≠ Provider
usage; Project Admin authority ≠ plaintext secret access; configuration fallback ≠ runtime failover;
Project credential (AD-01) ≠ LLM Provider credential (this decision).

---

## 4. Current Provider Implementation (Fresh Research, This Decision)

Traced directly from source, not merely cited from the synthesis, per task instruction.

### 4.1 Schema and CRUD (`provider.model.js`, `.repository.js`, `.service.js`, `.controller.js`,
`.routes.js`, `.validator.js`)

**FACT:** `Provider = { ownerId: ObjectId→User, label, baseURL, apiKeyEncrypted, defaultModel,
isDefault, timestamps }`. One combined record — no separate vendor/credential/model entities. Every
route requires Clerk auth (`authMiddleware`); every service method checks
`provider.ownerId.toString() !== userId.toString()`. **`_formatProvider()` never includes
`apiKeyEncrypted` or any decrypted value** — the API surface has never returned plaintext, at any
point, to any caller, including the owner. Update supports rotating `apiKey` in place (re-encrypts,
same record). Delete is blocked if `agentRepository.count({ providerId, ownerId: userId }) > 0` —
**FACT confirming AD-04 §17's flagged gap**: this count is scoped to `ownerId`, which silently
undercounts dependents for any future Project-shared Provider (resolved, §22).

### 4.2 Runtime resolution (`agent.factory.js`)

**FACT**, traced directly:

```
buildAgent(agentId, userId, checkpointer)
  if agentId === ARCHITECT_AGENT_ID:
    providers = providerRepository.findByUser(userId)
    provider = providers.find(p => p.isDefault) || providers[0]   ← "first found" fallback
    if !provider: throw 'No provider configured...'
  else:
    agent = agentRepository.findById(agentId)
    if !agent.providerId: throw 'Agent has no valid provider configured.'
    provider = providerRepository.findById(agent.providerId)
    if !provider: throw 'Configured Provider not found or was deleted.'
  ...
  llm = _buildLLM(agent, provider)
    apiKey = encryption.decrypt(provider.apiKeyEncrypted)
    assertProviderCredentials(provider, apiKey)   // rejects empty/placeholder keys
    modelName = agent.modelName || provider.defaultModel || 'gpt-3.5-turbo'
    return new ChatOpenAI({ apiKey, modelName, configuration: { baseURL, apiKey } })
  ...
  result = { agentInstance, agentConfig, llm, providerConfig: { id, label, apiKey: <PLAINTEXT>, baseURL, modelName }, mcpAppMap }
  agentCache.set(`${cacheKey}:${userId}`, result)
```

**Two distinct resolution paths exist today, not one:** regular Agents require an **explicit**
`providerId` (Option A behavior); the Architect meta-agent has **no** stored `providerId` and
instead resolves the user's flagged-default-or-first Provider **dynamically at build time**
(Option-B-like, but currently Architect-only).

**FACT, a real finding:** the cached `result.providerConfig` object includes the **decrypted
plaintext `apiKey`**, held in the AgentFactory's in-process LRU cache. Tracing every consumer
(`agui.service.js`, `aguiTranslator.js`): only `providerConfig.label` is ever read downstream
(for a friendlier error message); the plaintext `apiKey` field appears to be **carried but unused**
after construction. Not an active leak (never crosses a process/trust boundary), but a hygiene point
worth tightening in the target architecture (§16.4).

### 4.3 Credential rotation cache invalidation (`provider.service.js`)

**FACT, already correct and worth preserving exactly:** `updateProvider()` — when the API key
changes — looks up every agent referencing the provider
(`agentRepository.findAgentsUsingProvider(providerId, '_id')`) and calls
`agentFactory.invalidate(agent._id)` for each, **plus** explicitly invalidates the Architect's cache
entry. This is the codebase's own, already-working answer to "rotation must not leave a stale cached
client with the old secret" (§24).

### 4.4 Knowledge/embeddings (`knowledge.service.js`)

**FACT, a significant finding directly answering two of the task's research questions
simultaneously:**

```javascript
/**
 * Lazy-initializes the OpenAI embedding instance using the platform's
 * global OPENAI_API_KEY (not the user's personal provider key).
 */
_getEmbeddings(modelName, provider = null) {
  ...
  if (provider) { apiKey = decrypt(provider.apiKeyEncrypted); baseURL = provider.baseURL; }
  if (!apiKey) { apiKey = config.ai.openAiApiKey; }   // ← platform env-var fallback
  ...
}
```

Called as `_getEmbeddings(embeddingModel, provider)` from `_getVectorStore()`, where `provider` is
resolved from the optional `KnowledgeBase.providerId` field if set, else `null`. **This confirms
two things at once:** (1) **Provider today already covers embeddings, not chat-only** — the same
`Provider` record type is reused for both purposes; (2) **a genuine Platform/Internal Provider
category already exists in evidence** — `config.ai.openAiApiKey` (from the `OPENAI_API_KEY`
environment variable, `config/ai.config.js`, `config/index.js`) is a platform-operator-owned
credential, unrelated to any `PersonaUser` or `Project` ownership, used as a compatibility fallback
when a Knowledge Base has no Provider explicitly configured. **This is not invented by this
decision — it is confirmed, evidenced, pre-existing behavior** (§18).

### 4.5 Other findings

**FACT:** the Architect's `list_my_providers` tool (`builder.tools.js`) already returns Provider
metadata (label, baseURL, defaultModel) **explicitly excluding the key** ("Sensitive keys are NOT
included") — independent, additional evidence the codebase already distinguishes metadata-access
from secret-access in at least one place. **FACT:** the tool comment for agent creation states "You
CANNOT view or manage API keys" — the Architect itself is documented as never handling secrets.
**FACT:** no automatic failover-to-a-different-provider logic exists anywhere in the traced code —
every failure path (`_buildLLM`, `_assertProviderCredentials`) throws explicitly.

---

## 5. Provider Terminology / Conceptual Model

**Core Question 1, answered directly from evidence: Option C — Provider = vendor endpoint +
credential + configuration, combined into one record**, not split further. `baseURL` +
`defaultModel` as free-text strings, universally constructed via `ChatOpenAI` regardless of actual
vendor, confirm Persona already treats "Provider" as "an OpenAI-API-compatible endpoint + key +
default model" — not a first-class "vendor" abstraction. **DECISION: preserve this shape exactly.**
No separate `Vendor`, `Credential`, or `Model` entity is introduced — none is evidenced, and
inventing one would violate the task's explicit warning against introducing abstractions "merely
because cloud platforms use them."

---

## 6. Provider Ownership

Extends AD-04 §17 with the "who owns the credential" question resolved precisely:

**DECISION:** `OwnerType` (`PersonaUser` or `Project`) governs **administrative authority over the
Provider record** — who may create, update metadata, rotate the secret, disable, delete, and select
it as a default. It does **not**, by itself, mean the owner can retrieve plaintext (§16) — this is
already true today (an owning Persona User cannot retrieve their own plaintext key via any API,
**FACT** §4.1) and this decision generalizes that exact posture to Project ownership without
weakening it.

**Worked answer to the task's own question:** if Project Admin Raiyan creates a Provider for Beyond
Campus, `Owner = Project`, `Creator = Raiyan` — directly reusing AD-04 §12's Creator≠Owner rule,
already established, not re-derived here. If Raiyan later leaves Beyond Campus, the Provider remains
with the Project, unaffected — same mechanism as any other Project-owned resource (AD-04 §12.1).

---

## 7. Provider Models Considered (Agent-Level Selection)

**Option A — every Agent explicitly references Provider + model.** Today's actual behavior for
regular (non-Architect) Agents (§4.2).

**Option B — Project has a default Provider/model; Agent may inherit or override.** Today's actual
behavior for the Architect specifically (dynamic default-or-first resolution), generalized here to
System/Project-owned and external-user-owned Agents within a Project.

**Option C — Agent stores only model intent/capability; runtime resolves Provider.** No evidence
supports this level of abstraction anywhere in the current codebase (no capability-routing concept
exists) — considered and rejected as speculative, violating the task's explicit warning against
over-engineering model routing without evidence.

**Option D:** no stronger evidence-backed alternative found; Option B, generalized, already covers
the Persona-compatibility, Project-usability, and deterministic-resolution requirements together.

---

## 8. Comparison Matrix

| Criterion | A. Always explicit | B. Default + override (selected) | C. Abstract capability routing |
|---|---|---|---|
| Persona compatibility | Full (today's regular-Agent behavior, unchanged) | Full — Architect's existing default-resolution *shape* generalizes cleanly; regular Agents keep explicit references unless a Project chooses otherwise | Would require reinterpreting existing `providerId`/`modelName` fields with no evidenced need |
| Project usability | Poor — every user-created Agent must be manually configured, friction for external users like Sabik | Good — Project sets one default, most Agents need no Provider decision at all | N/A — solves a problem (dynamic routing) nobody has asked for |
| User-created Agent support | Works, but high friction | Works, low friction — directly serves the "Sabik creates an Agent easily" product goal | Unproven fit |
| Security | Neutral — selection mechanism doesn't affect secret exposure | Neutral, same reasoning | Neutral, but adds an unnecessary resolution layer to reason about |
| Deterministic behavior | Fully deterministic (no fallback at all) | Fully deterministic — the fallback CHAIN itself is fixed and explainable (§15) | Risk of non-obvious routing decisions, harder to explain |
| Operational/Project Admin control | Full — Admin sets every Agent explicitly | Full — Admin still controls the default and every explicit override | Diminished — routing logic obscures direct control |
| Credential rotation | Straightforward, existing mechanism (§4.3) unaffected by selection model | Same — rotation invalidates by dependent-Agent lookup regardless of how the Agent found the Provider | Would complicate dependent-lookup (capability-based references harder to enumerate) |
| Future model routing | N/A | N/A — explicitly not designed here, doesn't preclude it later | Would need to exist for this option to make sense — no evidence justifies building it now |

---

## 9. Selected Provider Model

**DECISION: Option B, generalized** — for the reasons in §8, and because it is the only option that
serves the Project-usability requirement (frictionless Agent creation for external users) without
sacrificing determinism or inventing unevidenced abstraction.

---

## 10. Persona Provider Semantics

**DECISION: unchanged.** Regular Persona Agents continue requiring an explicit `providerId` (§4.2,
Option A behavior, preserved exactly — Persona is not forced through Project-shaped default/override
semantics it never asked for, consistent with AD-03's "Persona is a Domain, not a Project"
principle). The Architect's existing default-or-first-provider resolution is preserved **exactly as
today**, including its "first found" fallback — this decision does **not** retroactively tighten
Persona's own existing behavior; it only declines to **propagate** that specific fallback pattern
into the new Project surface (§15).

---

## 11. Project Provider Semantics

**DECISION:** a Project may configure a **default Provider + model** (new capability, no Persona
analog required to be identical). System/Project-owned Agents and external-user-owned Agents within
that Project, if they carry no explicit `providerId`, resolve to this default. Setting/changing the
Project default is a Project Admin authority action (§17) — never automatic, never inferred from
"whichever Provider was created first."

---

## 12. External-User-Owned Agent Behavior

**Directly resolving the task's critical case:** Sabik creates Agent A, `Owner = (Beyond Campus,
ExternalUser, sabik)`; Agent A explicitly or by default references Beyond Campus's Provider P,
`Owner(P) = (Beyond Campus, Project)`. **DECISION: this is fully supported and is the expected,
common case for Project resources**, not an exception requiring special handling.

- **Provider usage never transfers or implies ownership** (§6) — Sabik's Agent using P does not make
  Sabik an owner or administrator of P.
- **Sabik never gains plaintext access to P's credential** (§16) — structurally impossible under any
  circumstance, matching the task's explicit requirement.
- **Choice among Providers, derived from AD-04/AD-05, not newly invented:** since `ExternalUser`
  cannot own a Provider (AD-04 §17) and cross-Domain Provider references are forbidden (AD-05 §22),
  Sabik's Agent's *only possible* Provider choices are, by construction, **Project-owned Providers
  within Beyond Campus's own Domain** — there is no other category to select from. **This means the
  Domain boundary itself is already sufficient policy for v1** — no separate Provider "allow-list" or
  access-policy engine is needed, because the choice set is already minimal and correct by
  construction, not by an additional restriction layer. A finer-grained allow-list (restricting to a
  *subset* of the Project's own Providers) remains a plausible, architecture-compatible future
  extension — **OPEN**, not needed now, consistent with the task's explicit instruction not to design
  a policy engine.
- **Model choice:** Sabik's Agent may set `modelName`, overriding the chosen Provider's
  `defaultModel` — the existing `agent.modelName || provider.defaultModel` pattern (§4.2), unchanged,
  applies identically to Project Agents.

---

## 13. Project Default Provider/Model

Restating §11's decision with the requested reduces-duplication analysis: a Project default
**directly serves the Developer Platform's usability goal** — without it, every one of a Project's
System Agents *and* every external user's self-created Agent would need explicit, repeated Provider
configuration, which is both unnecessary friction and a real source of drift (Provider rotated →
every Agent's explicit reference still points at the same record, fine — but a *new* Agent created
without guidance has no signal for which Provider to use). A default is **not assumed correct
without comparison**: compared against "every Agent explicitly references a Provider" (§7 Option A),
the default+override model strictly dominates for Project usability while losing nothing for
Project Admin control (an Admin can always still force explicit references where desired) —
justifying the selection in §9.

---

## 14. Agent-Level Provider/Model Configuration

Consolidating §10–13: an Agent's effective Provider is resolved as `agent.providerId` (explicit,
highest priority) → Project default (if the Agent's Domain is a Project) → [Persona-only:
Architect's existing legacy resolution] → fail closed. `agent.modelName` overrides
`provider.defaultModel` throughout, unchanged from today (§4.2). Full algorithm, §15.

---

## 15. Runtime Provider Resolution Algorithm

**Derived from evidence (§4.2), not assumed — generalized with Domain per AD-05, and made
deterministic per the task's explicit requirement:**

```
1. Resolve Agent (Domain-qualified lookup, AD-05 §11)
2. Determine effective Provider reference:
   a. Agent has explicit providerId          → use it
   b. else Agent's Domain is a Project with
      a configured default Provider          → use the Project default
   c. else Agent's Domain is Persona AND
      Agent is the Architect meta-agent       → today's existing default-or-first
                                                 resolution (Persona-only, unchanged, §10)
   d. else                                    → FAIL CLOSED: explicit, explainable error
3. Resolve the Provider record (Domain-qualified lookup, AD-05 §11);
   verify same Domain as the Agent (defense-in-depth, AD-05 §22)
4. Verify Provider is usable (not disabled/deleted) → else FAIL CLOSED (§21 — no fallback here)
5. Resolve effective model: agent.modelName || provider.defaultModel (unchanged, §4.2)
6. Decrypt credential internally, only within the narrow resolution boundary (§16)
7. Construct model client
8. Execute
```

Every step has exactly one defined outcome for any given input — **deterministic and explainable**,
per the task's explicit requirement. Step 2's chain is the *only* fallback in this algorithm, and it
is a **configuration** fallback (decided in advance), not a runtime failover (§21).

---

## 16. Secret Authority / Decryption Boundary

**The most security-critical section. Verified against, not merely designed independent of, the
current implementation (§4).**

### 16.1 What's already correct today (preserved, not rebuilt)

**FACT:** plaintext is **never** returned via any Provider API response, to any caller, including
the owner (`_formatProvider`, §4.1). Decryption today happens in exactly three legitimate,
narrowly-scoped places: test-connection/list-models (server-side outbound call; response never
includes the key), `AgentFactory._buildLLM` (chat client construction), and
`KnowledgeService._getEmbeddings` (embeddings client construction). **DECISION: this is the correct
shape and is preserved, formalized, and extended to Project-owned Providers unchanged** — not
redesigned from scratch.

### 16.2 The rule

**DECISION:** plaintext Provider credentials are accessible **only** within a narrow **Provider
Resolution boundary** (conceptually a `ProviderResolver`/secret-decryption service — illustrative
name, not binding) consumed exclusively by: (a) chat-model construction, (b) embeddings-client
construction, (c) the explicit, response-excludes-the-key test-connection/list-models operations.
**No generic, broadly-callable "get plaintext key" method exists anywhere**, for any principal —
not the owning Persona User, not a Project Admin, not Platform Admin (AD-04 §19 already forbids
Platform Admin from being treated as an owner; this extends that to forbid plaintext access
entirely, for anyone, outside the narrow resolution boundary).

### 16.3 Who may *trigger* these operations (authority), vs. who may *see the result* (nobody, for
plaintext)

| Action | Authority required | Plaintext ever visible to them? |
|---|---|---|
| Create / update metadata / rotate secret / disable / delete | Owner (PersonaUser) or Project Admin (for `Owner = Project`) | **No** — submitting a new secret is one-way; it is never redisplayed (§16.4) |
| Test connection / list models | Same as above | **No** — result is success/model-list only |
| See masked metadata (label, baseURL, model, status) | Same as above | N/A — no secret involved |
| Select as Project default | Project Admin | N/A |
| Runtime execution use (build a client) | The internal resolution boundary only, triggered indirectly by any Runtime Actor executing an Agent that resolves to this Provider | Plaintext exists only transiently, server-internal, never returned |
| Obtain plaintext directly | **Nobody, ever, through any API** | — |

### 16.4 Cross-decision consistency and a recommended tightening

**DECISION:** rotating a Provider secret follows the **same "shown once, never again" posture**
already decided for Project API credentials in AD-01 §9.2 — submitting a new key encrypts it
immediately and it is never redisplayed, matching the exact convention this codebase independently
arrived at twice, reinforcing it as the right general pattern, not a coincidence to ignore.
**Recommended (implementation-phase, not mandated) tightening:** the cached `providerConfig.apiKey`
plaintext field identified in §4.2, which appears unused after client construction, should be
dropped from the cached result bag — minimizing how long/where decrypted material lingers in memory,
even though it currently never crosses a trust boundary.

### 16.5 Runtime Actors have no independent Provider-record access

**DECISION:** a Runtime Actor (e.g., Rahul, chatting with an agent) has **no** direct authority over
the Provider record at all — not even masked metadata access. Whatever they may indirectly learn
(e.g., "this agent uses GPT-4") flows through the Agent's own visibility/configuration surface (AD-04
§21), never through independent Provider-record querying.

---

## 17. Project Admin Authority

Applying AD-04 §18 directly: Project Admin authority covers create / update metadata / rotate /
disable / delete / select-as-default for Project-owned Providers — **never** plaintext retrieval
(§16), and never implies personal ownership of a Provider they administer or create (AD-04 §12.3,
§24-#6, reaffirmed here). This is a direct, unmodified application of AD-04's general rule to
Provider specifically — no new authority concept is introduced.

---

## 18. Platform/Internal Provider Behavior

**Core research question, answered with direct code evidence (§4.4), not invented.**

**FACT:** `config.ai.openAiApiKey` (the `OPENAI_API_KEY` environment variable) is a genuine,
pre-existing, platform-operator-owned credential — unrelated to any `PersonaUser` or `Project`
ownership — used as a compatibility fallback for Knowledge Base embeddings generation when no
Provider is explicitly configured.

**DECISION:** formally recognize **Platform/Internal Provider** as a legitimate third category,
architecturally separate from `PersonaUser` and `Project`, with hard restrictions:

1. **Never Domain-scoped the way PersonaUser/Project Providers are** — it belongs to the platform
   operator, outside any Project's or even Persona's own resource-ownership model.
2. **Never selectable or referenceable by any Agent**, Persona's or a Project's — not exposed as an
   available Provider choice anywhere (§12's Domain-boundary-is-sufficient-policy finding relies on
   this exclusion holding).
3. **Never exposed through any Provider-listing/selection API** to any Project or Persona User.
4. **Scope is not extended beyond what's evidenced** — currently, embeddings compatibility for
   the Persona Domain only. **This category is explicitly not generalized into a cross-Domain chat-
   execution fallback** — see §21's Runtime Failover decision, which directly forbids exactly that
   extension. A Project's chat-LLM execution never falls back to this credential, under any
   circumstance.

---

## 19. Model Identity

**Core research question:** does the current implementation distinguish Provider-configuration from
an abstract "Model" entity? **FACT: no.** `defaultModel` is a free-text string on the Provider
record; `Agent.modelName` optionally overrides it; no separate Model registry exists anywhere.
**DECISION: preserve this exactly** — no global model registry is introduced, consistent with the
task's explicit warning. **Two Provider configurations for the same vendor may trivially expose the
same model string** (e.g., "Beyond Campus OpenAI Production" and "Beyond Campus OpenAI Backup" both
offering the same model) — nothing in the current flat design prevents this, and nothing needs to
change to support it; it already works by construction. Agent configuration references
`providerId + modelName`, unchanged.

---

## 20. Configuration Fallback

**DECISION, precisely defined per the task's explicit distinction:** configuration fallback is the
resolution *chain itself* (§15 step 2) — a fixed, decided-in-advance sequence:
`Agent explicit → Project default → [Persona: Architect legacy] → fail closed`. This is **not**
reactive; it does not depend on anything failing at runtime. It is evaluated once, deterministically,
for any given Agent, regardless of whether execution later succeeds or fails.

---

## 21. Runtime Failure / Failover

**DECISION: no automatic runtime failover exists.** If the Provider resolved by §15's algorithm
fails at execution time — invalid/revoked credential, vendor outage, disabled, deleted — **the
request fails explicitly**, matching today's actual, evidenced behavior (`_buildLLM` throws; no
failover-to-a-different-provider code path exists anywhere in the codebase, §4.5). This is **Option
A** from the task's fallback-options list.

**Options B/C/D evaluated and rejected:**
- **B (fallback to Project default) at *failure* time** — rejected as a *runtime failover*
  concept, distinct from the *configuration* fallback already decided in §15/§20 (which only applies
  when there was never an explicit reference in the first place, not when an explicit reference
  fails).
- **C (fallback to platform/Persona provider)** — **explicitly forbidden**, per the task's own hard
  rule and §18's restriction: a Project request must never silently fall back to a Persona user's
  credential or the Platform/Internal Provider. No exception is made here.
- **D (fallback only under explicit configured policy)** — no evidence justifies building
  configurable failover policy now; explicit failure is simpler, safer, and matches the task's stated
  preference for deterministic, fail-closed behavior over surprising automatic fallback. **OPEN** for
  reconsideration only if real operational evidence (e.g., frequent transient vendor outages causing
  measurable product harm) emerges later.

**Configuration fallback ≠ runtime failover, restated as the core distinction:** "Agent has no
explicit Provider → use Project default" (§20, decided in advance) is categorically different from
"Agent explicitly selected Provider A; Provider A fails → silently execute using Provider B"
(rejected, this section) — the task's own example, directly resolved.

---

## 22. Provider Disable/Delete/Rotation Lifecycle

**DECISION: Disable and Delete are distinct, non-equivalent operations** (Disable does not exist as
a concept in today's schema — this decision introduces it conceptually, not as a field):

- **Disable** — reversible; makes the Provider immediately unusable for *new* resolutions (§15 step
  4 fails closed) without deleting the record or breaking references. Agents referencing it remain
  configured, simply non-executable until re-pointed or the Provider is re-enabled.
- **Delete** — **DECISION, resolving AD-04 §17's flagged gap directly:** the existing dependency-
  block safeguard (`agentRepository.count({providerId, ownerId: userId})`, §4.1) must become
  **Domain-scoped, not owner-scoped** — `count({providerId, domain})` — since a Project-owned
  Provider is routinely referenced by many *different* external-user-owned Agents, not agents
  sharing one "owner." This directly resolves the exact undercounting risk AD-04 §17 identified as
  future work, and is the correct, minimal place to resolve it. A Project's default Provider should
  be guarded by the same dependency logic (Agents *relying on it as the default* count as dependents
  too, conceptually — a nuance for the later schema decision, principle stated here).
- **Rotation** — in-place secret replacement on the same record, same references; **preserves
  today's already-correct invalidation mechanism exactly** (§4.3, §24), now Domain-scoped.

**Edge cases, per the task's list, target behavior:**

1. Project Provider disabled while 20 Agents reference it → all fail closed at next execution,
   deterministic error, no data loss, fully reversible.
2. Provider deleted while Agents reference it → blocked by the (now Domain-scoped) dependency check;
   if ever force-deleted through a future, separately-designed admin path, dependent Agents fail
   closed at resolution with "Provider not found," matching today's message (§4.2).
3. Project default Provider deleted → guarded the same way as an explicitly-referenced deletion
   (above).
4. Credential rotated → existing invalidation mechanism, now Domain-scoped (§24).
5. Credential becomes invalid at the vendor → surfaces as an execution-time failure; fails explicitly
   (§21), unchanged from today.
6. Project Admin who created the Provider leaves → non-event; `Owner = Project`, unaffected (AD-04
   §12.1, reaffirmed, not re-derived).
7. Persona User deletes their own Provider → unchanged, existing behavior preserved exactly.
8. Project suspended → per AD-03 §16, runtime execution stops platform-wide for the Project; Provider
   records/secrets remain intact, undeleted, ready to resume — no Provider-specific mechanism needed
   beyond the Project-level suspension guarantee already established.
9. Project deleted → Provider records, being ordinary Domain-scoped resources, fall within
   whatever eventual Domain-deletion mechanism is designed later (AD-03/AD-05, still **OPEN**) — no
   special-casing introduced here.

---

## 23. Referential Integrity

Directly applying AD-05 §22's general pattern to Provider: **DECISION** — when an Agent's
`providerId` is set or changed, validate at **attachment time** that the referenced Provider belongs
to the same Domain as the Agent, rejecting the update otherwise; **re-verify at runtime** as
defense-in-depth (§15 step 3) — the same two-point enforcement AD-05 already established generally,
applied here without modification.

---

## 24. Cache / Invalidation Requirements

**DECISION: preserve the existing, already-correct explicit-invalidation-on-write mechanism (§4.3),
generalized to Domain-scoped dependent lookup** (§22), rather than switching to a credential-
version-embedded cache key. Today's approach — enumerate dependent Agents on rotation/disable/
delete/default-change and explicitly evict their cache entries (`agentFactory.invalidate`) — already
correctly satisfies "rotating credentials must not leave runtime indefinitely using a cached client
with the old secret," and is proven, working code, not a gap to close. **OPEN, flagged as an
alternative, not adopted:** if Domain-scoped dependent-Agent enumeration ever becomes expensive at
very large scale (many thousands of dependents per Provider), a credential-generation-counter
embedded in the cache key (per AD-05 §21's matrix) would avoid needing to enumerate at all — noted as
a viable future evolution, not needed now.

---

## 25. Billing / Usage-Attribution Constraints

**Not designing billing — determining only whose credential is consumed and what runtime must
retain, per task scope.**

**DECISION:** vendor-side usage cost follows the Provider's `OwnerType`: `PersonaUser`-owned →
that Persona User's own vendor account/credential bears the cost (unchanged, today's reality);
`Project`-owned → the Project's vendor account/credential bears the cost, **regardless of which
external user's Agent execution triggered it** — Sabik's Agent execution consumes Beyond Campus's
own credential and (implicitly) its own vendor billing relationship, not Sabik's, not Persona's;
`Platform`-owned → Persona itself bears the cost (currently: embeddings compatibility, an existing,
already-accepted operational cost, unchanged by this decision).

**Minimum information runtime should retain (conceptually, not as a schema) for future accounting:**
per execution — Domain, Agent, Subject (who ran it), Provider used, effective Model, and the
Provider's `OwnerType` category (since that determines which vendor bill was actually hit). This is
the minimum basis for any future Project-level usage dashboard, quota system, or per-user limit —
none of which are designed here.

---

## 26. Observability / Audit Requirements

**DECISION:** extend, don't replace, today's already-correct masked-key logging convention
(`maskedKey` pattern, **FACT** §4.2, consistent with `AGENTS.md`'s security rules) — structured
execution logs should conceptually carry Domain, Agent, Subject, Provider identity + label,
effective Model, and Provider `OwnerType` category. **Never log:** plaintext API keys, authorization
headers, or any decrypted secret value, under any circumstance — reaffirming existing practice, not
introducing a new one.

---

## 27. Security Analysis

Threat-modeled against every item the task specified:

1. **Project A resolving Project B Provider** — prevented by AD-05's mandatory Domain-qualified
   lookup, reaffirmed here at both attachment time and runtime (§23).
2. **External user reading Project Provider secret** — structurally impossible: plaintext is never
   returned via any API, to any principal, under any circumstance (§16.2).
3. **Project Admin retrieving plaintext secret unnecessarily** — same; administrative authority
   never includes plaintext retrieval (§16.3, §17).
4. **Provider IDOR** — same universal Domain+ID pairing rule as every other AD-05 resource, no
   special exemption (§4.1, AD-05 §11).
5. **Agent referencing cross-Domain Provider** — attachment-time + runtime validation (§23).
6. **Deleted Provider silently falling back cross-Domain** — explicitly impossible: no automatic
   failover exists at all (§21), let alone a cross-Domain one.
7. **Project Agent falling back to Persona credential** — explicitly forbidden (§18, §21) — the
   Platform/Internal Provider category's scope is fixed and never extended to this case.
8. **Stale cached client after credential rotation** — mitigated by the preserved, Domain-scoped
   explicit-invalidation mechanism (§24).
9. **Logs containing decrypted keys** — mitigated by preserving the existing `maskedKey` convention
   (§26).
10. **Creator being treated as credential owner** — reaffirms AD-04's Creator≠Owner rule applied to
    Provider specifically (§6); a creating Project Admin never gains personal ownership or special
    plaintext access.
11. **External user supplying arbitrary `providerId`** — mitigated by attachment-time Domain-match
    validation; an external user cannot successfully attach a cross-Domain Provider reference to
    their own Agent (§12, §23).
12. **Project credential (AD-01) confused with LLM Provider credential (this decision)** —
    **explicitly named and guarded against**: these are two entirely different secret types serving
    different purposes — AD-01's Project credential authenticates the Project's *backend* to
    Persona's Developer API; a Provider's credential authenticates *Persona's own outbound calls* to
    an LLM vendor on the Project's behalf. **DECISION:** these must never be conflated in
    terminology, storage, or code — flagged explicitly as an implementation-phase naming/separation
    constraint (§34), because both are colloquially "the Project's credential" and the confusion risk
    is real.
13. **Platform/internal credential leaking into Project configuration** — mitigated by §18's hard
    restriction: never selectable, never exposed through any listing API to any Project.
14. **Malicious external-user-created Agent attempting to select an unauthorized Provider/model** —
    mitigated by the Domain-boundary-is-sufficient-policy finding (§12): the choice set is already
    minimal and correct by construction (Project-owned Providers only, same Domain only), and
    attachment-time validation rejects any attempted cross-Domain reference outright.
15. **Provider test endpoint exposing secret/result details** — reaffirms today's already-correct
    behavior: test/list-models responses never include the key, only success/model-list (§4.1,
    §16.1) — the same posture extends unchanged to Project-owned Provider testing.
16. **Project suspension continuing to consume Provider credentials** — inherits AD-03 §16's
    Project-level suspension guarantee (runtime execution stops platform-wide for the Project); no
    Provider-specific mechanism is needed beyond that.

**Fail-closed posture, stated explicitly:** every failure mode in this decision — missing
configuration, disabled/deleted Provider, invalid credential, cross-Domain reference attempt —
resolves to an explicit error, never a silent substitution. This decision introduces **zero**
automatic cross-Domain or cross-ownership fallback paths of any kind.

---

## 28. Migration / Compatibility Impact

**DECISION:** Provider follows AD-05 §25's general durable-resource classification —
**LOW–MEDIUM** migration risk: an additive, defaulted Domain field (Persona's existing Providers
default to the Persona-Domain constant, zero behavior change, consistent with every other durable
resource type). **New in this decision, not previously assessed:** the Domain-scoped dependency-
check fix (§22) and the introduction of a `Disabled` state (§22) are additive, non-breaking changes
to existing Provider records — no existing Provider's behavior changes as a result of either. The
Architect's existing "first found" fallback (§10) is untouched, so no Persona-facing behavior change
results from this decision at all.

---

## 29. Rejected Alternatives

### 29.1 Decomposing Provider into separate Vendor/Credential/Model entities (§5, Option D-space)

Rejected — no evidence supports it; the current combined-record shape already works and handles
every required case (§4.1, §19).

### 29.2 Option C — Agent stores abstract model intent, runtime resolves Provider (§7)

Rejected — no capability-routing concept exists in evidence; would require reinterpreting stable,
working fields for no demonstrated benefit (§8).

### 29.3 Runtime failover to Project default, Platform provider, or any other Provider on execution
failure (§21, Options B/C/D)

Rejected — conflates configuration fallback with runtime failover (explicitly warned against);
Option C specifically violates the task's hard cross-Domain-fallback prohibition; Option D adds
unjustified complexity absent evidence of need.

### 29.4 Propagating the Architect's "first found" fallback into Project default resolution (§10,
§15)

Rejected — while preserved for Persona's existing Architect behavior (no forced change, AD-03
principle), this pattern is not extended to the new Project surface because it fails the task's
explicit "deterministic and explainable" bar; an unconfigured Project should fail closed, not
silently pick an arbitrary Provider.

### 29.5 External-user-owned Providers (BYOK at the runtime-user level)

Considered per the task's explicit prompt and **not adopted** — no current product requirement asks
for it (requirements list Provider ownership/billing as explicitly undecided, and §18 of the
requirements document enumerates user-ownable resource types without including Provider). Not
invented merely for flexibility, per the task's explicit instruction.

---

## 30. Consequences for Runtime Architecture

AgentFactory's resolution logic must implement §15's algorithm precisely, including the Domain-aware
branch for Project defaults and the removal of "first found" fallback outside the Persona/Architect
case. The cache invalidation mechanism (§24) must become Domain-scoped rather than owner-scoped when
dependent-Agent lookups are generalized. The `providerConfig` cached-plaintext hygiene note (§16.4)
should be addressed during that same refactor.

## 31. Consequences for Developer API

Any future Developer API surface exposing Provider management must enforce the exact authority
boundaries in §16.3/§17 (Project Admin authority for CRUD/rotate/disable/select-default; never a
plaintext-returning endpoint, for any principal). Any endpoint letting an external user's Agent
reference a Provider must rely on the Domain-boundary-is-sufficient-policy finding (§12) — no
additional allow-list mechanism needs to be built for v1.

## 32. Consequences for Developer Studio

Provider management screens (create/rotate/disable/delete/set-default) operate under Project Admin
authority (AD-04 §6.4's Clerk-session-based Project Admin identity), never display plaintext secrets
at any point, and should surface "referenced by N Agents" using the corrected, Domain-scoped
dependency count (§22) rather than an owner-scoped one.

---

## 33. Open Questions

1. Whether a Project-level Provider allow-list (subsetting available Providers for user-created
   Agents) is ever needed — §12, not currently evidenced.
2. Whether runtime failover under explicit, opt-in policy is ever justified — §21, Option D,
   deferred pending operational evidence.
3. Whether Domain-scoped dependent-Agent enumeration remains performant at large scale, or whether a
   credential-generation-counter cache key becomes preferable — §24.
4. Exact mechanics of counting "Agents relying on a Project default" as dependents for deletion-
   guarding purposes — §22, a nuance for the later schema decision.
5. Whether Platform/Internal Provider ever needs a second evidenced use case beyond embeddings
   compatibility, and if so, whether its hard restrictions (§18) still hold — not anticipated, not
   precluded.

---

## 34. Implementation Constraints

Collected from §16, §22, §23, §27 for visibility, non-binding on exact implementation:

- No API or internal method may return a Provider's plaintext credential to any caller, under any
  circumstance — decryption is confined to the narrow resolution boundary (§16.2).
- The Provider dependency check used to guard deletion must be Domain-scoped, not owner-scoped
  (§22) — directly resolving AD-04 §17's flagged gap.
- Cache invalidation on rotation/disable/delete/default-change must remain explicit and
  Domain-aware (§24), not silently degrade to a stale-cache risk when generalized beyond
  single-owner Persona usage.
- Attachment-time and runtime Domain-match validation must both exist for Agent→Provider references
  (§23) — neither alone is sufficient, per AD-05's established two-point pattern.
- AD-01's Project credential and this decision's Provider credential must be kept distinctly named
  and never conflated in code, logs, or terminology (§27-#12).
- The Platform/Internal Provider category must never be exposed through any Provider-selection
  surface reachable by a Project or its Agents (§18).

---

## 35. Evidence / References

| Claim | Source |
|---|---|
| Provider schema, CRUD, ownership checks, `_formatProvider` never includes the key | `agent-backend/src/modules/providers/provider.model.js`, `.service.js`, `.repository.js` — read in full this session |
| Provider dependency-block-on-delete, scoped to `ownerId` | `provider.service.js` `deleteProvider()` — read this session |
| Regular-Agent explicit-`providerId` requirement; Architect's default-or-first resolution; `_buildLLM`; cached `providerConfig` with plaintext apiKey | `agent-backend/src/modules/agents/agent.factory.js` — read in full this session |
| Cache invalidation on provider update (`agentFactory.invalidate` per dependent agent + Architect) | `provider.service.js` `updateProvider()` — read this session |
| Platform env-var (`OPENAI_API_KEY`) embeddings fallback; Provider optionally used for embeddings via `KnowledgeBase.providerId` | `agent-backend/src/modules/knowledge/knowledge.service.js`, `config/ai.config.js`, `config/index.js` — read in full this session |
| `list_my_providers` tool excludes keys; Architect documented as unable to view/manage API keys | `agent-backend/src/modules/tools/builder.tools.js`, `agent.factory.js` (ARCHITECT_SYSTEM_PROMPT) — read this session |
| No automatic failover code path exists anywhere in the traced modules | Direct grep/read of `agent.factory.js`, `provider.service.js` this session; consistent with synthesis §7, §11 |
| AD-04 §17 flagged the owner-scoped dependency-count gap for future resolution | `architecture/04-ownership-and-authority.md` §17, §25 |
| AD-05 established Domain-qualified lookup as universal, no Provider exemption | `architecture/05-persistence-and-tenant-isolation.md` §18 |
| AD-01's "shown once, never again" secret posture | `architecture/01-project-authentication.md` §9.2 |
| `AGENTS.md` security rule: never log secrets, use `maskedKey` patterns | `AGENTS.md`, Security Rules |
| Requirements: Provider ownership/billing explicitly undecided; Provider absent from User-Owned Resources enumeration | `developer-platform-requirements.md`, "What Is Not Decided Yet"; §18 |

---

*This document decides Provider ownership, credential authority, runtime resolution, and
Project-level provider behavior only. It resolves the resource AD-04 and AD-05 both deliberately
deferred, grounded in fresh, direct research of the actual current implementation rather than
assumption. It explicitly defers exact schema, encryption implementation changes, RBAC, API
endpoints, Developer Studio UI, SDK design, billing, quotas, model-routing systems, and cross-Domain
sharing to later, separately-scoped decisions (§30–32 record the constraints each inherits).*
