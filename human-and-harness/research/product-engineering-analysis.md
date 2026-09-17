# Humans & Harness — V1 Product & Engineering Analysis

## 0. The product, in one paragraph

Humans & Harness lets an expert build an **AI consultancy firm** instead of a single AI chatbot. The expert uses "Agent Architect" to assemble one lead AI consultant, optional subagents, skills, tools/MCPs, and knowledge — and publishes the whole bundle as a firm on a marketplace. A user browsing the marketplace doesn't just "chat with a bot" — they open an engagement (task/project/case) with a firm, the firm scopes the problem like a real consultancy would, does the work using its agents/skills/tools, and delivers an output. Nothing gets deployed outside the platform in V1 — that's V2.

---

## 1. Concept hierarchy and definitions

Think of it as **org chart → engagement model**, two separate hierarchies that meet at "Consultancy."

**Org chart (who does the work):**
```
Consultancy (the firm — e.g. "FitWithAlex AI Fitness Consultancy")
 └─ AI Consultant (the lead/front-facing agent — the "partner" a user talks to)
     └─ Subagent(s) (specialists — e.g. Nutrition Agent, Workout Planning Agent)
         └─ Skill(s) (a trained capability/playbook a subagent or the lead can invoke)
             └─ Tool / MCP (external capability — calendar, fitness tracker API, search)
```

**Engagement model (how work gets requested and delivered):**
```
User problem/request
 → Conversation (discovery)
   → Scope of Work (what will be done, boundaries, deliverables)
     → Case / Task / Project (the actual engagement — see distinction below)
       → Work execution (lead consultant routes to subagents/skills/tools)
         → Deliverable(s)
           → Review / completion
```

Definitions, precisely:

| Term | Definition | Old-world equivalent |
|---|---|---|
| **AI Persona** (old concept) | A single configured agent with a personality/identity. Being replaced as the top-level product. | A single hire |
| **AI Agent** | A configured LLM instance with instructions, skills, tools — generic building block. | An employee |
| **AI Consultant** | The lead agent of a consultancy; the one the user actually talks to first. Orchestrates subagents. | A partner / engagement lead |
| **AI Consultancy** | The published, marketplace-facing entity — contains one AI Consultant + N subagents + skills + tools + knowledge. | The firm (e.g. "Deloitte") |
| **Subagent** | A specialized agent inside a consultancy, invoked by the lead consultant for a specific type of work. | A specialist/associate |
| **Skill** | A defined, reusable capability/playbook (instructions + maybe examples) that an agent can execute. Not itself an agent. | A methodology / SOP |
| **Tool / MCP** | An external integration (API, data source, calendar, search) an agent can call. | Software the firm uses |
| **Task** | The lightest-weight engagement type — a single, bounded ask with one deliverable, minimal scoping. | A quick favor / one-off request |
| **Project** | A multi-step engagement with several deliverables/milestones over time. | A project engagement |
| **Case** | Could be the umbrella term for "an engagement of any type" (task or project), OR a distinct third type for open-ended/diagnostic work — **this is ambiguous in the source material and needs a decision (see §13).** |
| **Scope of Work (SoW)** | The explicit definition of what the consultancy will and won't do for this specific engagement, agreed before work starts. | A real SoW/engagement letter |
| **Consultancy engagement** | The general term for "a user + a consultancy working together on something" — parent concept of task/project/case. | An engagement |

---

## 2. What actually changed, and what didn't

**Stays the same (don't touch this):**
- Agent Architect as the creation tool/interface
- The underlying primitives: agents, skills, tools/MCPs, knowledge/instructions
- The marketplace as the discovery surface
- The publish flow mechanics (creator finishes configuring → it goes live)
- Conversational interaction as the entry point for users

**Changes (this is the actual delta):**
1. **Cardinality**: creator now configures *one-to-many* agents (lead + subagents), not one agent.
2. **New object**: "Consultancy" as a container/entity that wraps the lead agent + subagents + shared skills/tools/knowledge + marketplace listing metadata (name, positioning, services offered).
3. **New interaction pattern**: user conversation must resolve into a *scoped engagement* (task/project/case) rather than staying an open-ended chat forever.
4. **New object**: Scope of Work — a lightweight artifact generated collaboratively between user and lead consultant before "real work" starts.
5. **New object**: Deliverable — the explicit output of an engagement (previously the whole product *was* the chat; now the chat is a means to an engagement with a deliverable).
6. **Agent Architect needs new capabilities**: helping a creator think in terms of "what services does my firm offer, what specialists do I need, what's my scoping/intake process" rather than "what personality does my bot have."

**Explicitly not changing in V1:** no website generation, no external deployment, no custom domains — that's V2.

---

## 3. V1 feature breakdown

### Creator side

**Consultancy creation (new top-level object)**
- Why: creator needs a container above "agent" to represent the firm.
- User does: names the consultancy, defines its focus area/services (e.g. "Fitness coaching for busy professionals"), picks a positioning statement.
- AI does: helps draft services list and positioning from a rough description (this is where Agent Architect's new consultancy-specific skill comes in).
- Data needed: `consultancy_id`, name, description, services[], status (draft/published).
- MVP: a form + AI-assisted drafting; no need for logo/branding tooling in V1.

**Lead AI Consultant creation**
- Why: someone has to be the front-door agent.
- User does: configures instructions/persona for the lead consultant (this part is basically identical to old "create your persona" flow).
- AI does: nothing new here — reuse existing agent creation.
- MVP: existing agent creation flow, just now scoped as "this is the lead agent of Consultancy X."

**Subagent creation**
- Why: specialization mirrors how real consultancies use specialists.
- User does: creates 1+ subagents, each with a narrow focus (e.g. "Nutrition Agent").
- AI does: Agent Architect should be able to *suggest* subagents based on the services the creator listed (e.g. "you said nutrition coaching — want a dedicated Nutrition Agent?").
- MVP: manual creation is required; AI-suggested subagent scaffolding is a strong P0/P1 nice-to-have, not a blocker.

**Skill creation**
- Why: unchanged mechanically from today, but now skills should be explicitly tied to *what stage of an engagement* they apply to (intake, execution, deliverable-generation).
- MVP: reuse existing skill creation; add an optional tag for "which engagement stage does this skill serve" — helps routing later, but can be skipped in the very first cut if time-constrained.

**MCP/tool configuration**
- Why: unchanged from today.
- MVP: reuse existing tool-attachment flow, just attach at the consultancy or subagent level.

**Consultancy publishing**
- Why: the unit that goes live on the marketplace is now the consultancy, not a lone agent.
- User does: reviews the assembled consultancy (lead + subagents + skills + tools), hits publish.
- AI does: could run a pre-publish self-check ("does every service have at least one skill/subagent that can fulfill it?") — good V1 quality gate, cheap to build.
- MVP: publish = flip status to live + list on marketplace with the consultancy's name/services/positioning.

### User side

**Marketplace discovery**
- Why: unchanged UX pattern, different unit of listing (consultancy card instead of agent card).
- MVP: list consultancies with name, services, short description — basically what the marketplace already does, pointed at the new entity.

**Consultancy profile / conversation entry**
- Why: user needs to understand what the firm does before/while talking to it.
- MVP: profile page (services list, positioning) + "start conversation" button, same as today's agent chat entry.

**Conversation → intake/discovery**
- Why: this is the new core loop — chat isn't the end state, it's the funnel into an engagement.
- AI does: the lead consultant asks discovery questions like a real intake call, then proposes a Scope of Work.
- MVP: the lead consultant's system instructions include an explicit "discovery → propose SoW" pattern; doesn't need to be a separate UI mode, just conversational.

**Scope of Work generation**
- Why: makes the engagement concrete and bounded — this is what makes it feel like a consultancy, not a chatbot.
- AI does: drafts a short SoW (what will be delivered, what's out of scope, rough steps) based on the discovery conversation.
- User does: approves or edits it.
- MVP: SoW as a simple structured object (problem statement, deliverable(s), out-of-scope notes) shown as a card the user confirms — this confirmation is what *creates* the task/project/case.

**Task / Project / Case creation**
- Why: this is the actual engagement record.
- MVP for V1: **strongly recommend collapsing this to one concept for V1** — e.g. just "Engagement," with a `type` field (task vs project) if you truly need the distinction, rather than building three separate object types and UX flows on day one. See §12 roadmap.

**Execution (consultancy does the work)**
- Why: this is where the lead consultant routes to subagents/skills/tools per the SoW.
- AI does: orchestration — decide which subagent/skill handles which part.
- MVP: lead agent's instructions include routing logic; doesn't need a fancy orchestration engine for V1, can be prompt-driven with the existing agent/subagent/skill primitives.

**Deliverable generation**
- Why: the explicit "we produced something" moment, mirrors real consultancy output.
- MVP: deliverable = a structured message/artifact in the conversation (doc, plan, list) tied to the engagement record, marked as "delivered."

**Engagement completion**
- Why: closes the loop, mirrors consultancy close-out.
- MVP: user marks engagement complete (optionally rates it); simple status flip, no invoicing/billing logic needed in V1 unless monetization is explicitly in scope (source material doesn't mention payments — flag this as an open question in §13).

---

## 4. What NOT to build in V1 — be strict

**Explicitly V2 (external deployment):**
- Generating a standalone website for the consultancy
- Custom domain / external hosting
- Embeddable widgets for the creator's own site
- White-label branding for external deployment

**Attractive but should be postponed regardless of the V1/V2 external-deployment line:**
- Billing/invoicing/payment flows for engagements (unless the source material implies monetization is core — it doesn't say, so don't build it until confirmed)
- Multi-consultancy comparison/discovery ranking algorithms
- Version history / rollback for consultancy configs (nice, not required to prove the concept)
- Complex orchestration engines (state machines, DAGs) for subagent routing — a well-prompted lead agent is enough for V1
- Separate first-class "Task" vs "Project" vs "Case" object types with distinct UX — collapse to one "Engagement" object with a type flag (see §3, §12)
- Analytics dashboards for creators (engagement volume, satisfaction scores) — useful later, not needed to validate the core loop
- Creator-to-creator subagent/skill marketplace (reusing another creator's skill in your consultancy) — interesting V2/V3 idea, not V1
- Real-time collaboration on Scope of Work (multiple stakeholders editing) — single-user SoW approval is enough
- Automated evals running in production/live traffic — V1 evals should be an offline dev-time gate, not a live system (see §11)

**The single most important discipline**: V1's job is to prove that *"talk to a consultancy → get scoped work → get a deliverable"* is a better experience than *"talk to a persona forever."* Everything that doesn't serve proving that loop should wait.

---

## 5. What to borrow from real consultancy operating models

Looking at how firms like McKinsey, BCG, Deloitte, KPMG, and Accenture actually run engagements, the useful *operational patterns* (not business model or org structure) are:

| Pattern | What it is in real consultancies | Translate to H&H V1? |
|---|---|---|
| **Intake/discovery call** | Structured conversation to understand the client's problem before scoping | **Yes** — this is the conversation → SoW step |
| **Scope of Work / engagement letter** | Explicit written agreement on deliverables and boundaries before billing starts | **Yes** — core V1 concept, keep it lightweight |
| **Workstreams staffed by specialists** | Different specialists own different parts of the engagement | **Yes, simplified** — this is subagents |
| **Methodology/playbooks (SOPs)** | Standardized approaches the firm reuses across clients | **Yes** — this is skills |
| **Partner oversight / QA review** | A senior person reviews work before it goes to the client | **Defer** — could be a lead-consultant self-check step later, not a separate human-in-loop system for V1 |
| **Status reporting / steering committee updates** | Regular check-ins during long engagements | **Defer** — only relevant once "Project"-length multi-week engagements are common; not needed to prove V1 |
| **Formal proposal/RFP response process** | How firms win new client engagements | **No** — marketplace discovery replaces this entirely |
| **Time & billing tracking** | Hourly/engagement-based billing | **No, unless monetization is explicitly scoped** — flag as open question |
| **Org hierarchy (partner/manager/associate/analyst levels)** | Multi-level staffing pyramid | **No** — lead consultant + flat subagents is enough; don't build a hierarchy of hierarchies |
| **Closure/handoff document** | Final wrap-up summarizing what was delivered | **Yes, lightweight** — this is just the deliverable + completion status |

The translation principle: **borrow the shape of "discovery → scope → specialized work → deliverable → close,"** skip everything that exists in real firms purely because of human org/incentive constraints (billing hierarchies, partner politics, RFPs).

---

## 6. Consultancy lifecycle (refined)

```
Creator creates Consultancy (name, services, positioning)
 → Creator configures Lead AI Consultant
 → Creator adds Subagents (optional, per service area)
 → Creator adds/attaches Skills
 → Creator attaches Tools/MCPs
 → Creator publishes Consultancy to marketplace
 ─────────────────────────────────────────────
 → User discovers Consultancy on marketplace
 → User opens conversation with Lead Consultant
 → Lead Consultant runs discovery (asks questions about the problem)
 → Lead Consultant proposes a Scope of Work
 → User approves/edits Scope of Work → this creates the Engagement
 → Lead Consultant routes work to Subagents/Skills/Tools as needed
 → Work is performed, Deliverable(s) produced
 → User reviews Deliverable
 → User marks Engagement complete (or requests revision → loop back to execution)
```

One refinement worth making: add an explicit **revision loop** (deliverable → user requests changes → back to execution) rather than treating completion as always-first-pass — this mirrors reality and is cheap to support since it's just "continue the conversation."

---

## 7. Personas

**Creator/Expert (consultancy founder)**
- Goal: turn their expertise into a scalable AI-driven practice.
- Actions: define services, build lead + subagents, attach skills/tools, publish, iterate based on user engagements.
- Needs: fast time-to-publish, confidence the consultancy will actually handle real user problems well, visibility into how engagements are going.
- Pain points: not knowing how to translate "what I know" into skills/subagents; fear of publishing something that gives bad output.
- Key journeys: A (create), E (modify/update).

**End user / client**
- Goal: get their specific problem solved by an expert-configured AI firm, not a generic chatbot.
- Actions: browse marketplace, evaluate consultancies, start conversation, approve scope, receive deliverable.
- Needs: clarity on what the consultancy can actually do, confidence the SoW matches what they asked for, a real deliverable at the end.
- Pain points: vague AI responses, scope creep/mismatch, no clear "we're done" moment.
- Key journeys: B (discover), C (start engagement), D (receive work).

**AI Consultant (lead agent) — system persona, not human, but worth defining behaviorally**
- Goal (as designed): run discovery well, scope accurately, route work correctly, keep engagement on track.
- Needs (from the system): good instructions, access to relevant subagents/skills/tools, a clear SoW format to fill in.

**AI Subagent — system persona**
- Goal: execute its specialized piece well when invoked by the lead.
- Needs: clear scope of what it's being asked to do by the lead (this is an internal routing/prompting design concern, not user-facing).

**Platform admin**
- Goal: ensure consultancies on the marketplace meet quality bar, moderate content.
- Actions: review/moderate published consultancies (this may already exist given the moderation tooling implied elsewhere in your product).
- Needs: visibility into consultancy quality signals (does it pass evals? are users completing engagements?).

---

## 8. Core user journeys

**Journey A — Create Consultancy**
Expert opens Agent Architect → describes their expertise/services in plain language → Agent Architect drafts consultancy name/positioning + suggests subagent breakdown → expert refines lead agent instructions → expert creates/edits subagents → expert attaches skills to lead/subagents → expert attaches tools/MCPs → expert reviews pre-publish checklist → publishes.

**Journey B — Discover Consultancy**
User browses marketplace → filters/searches by problem type → opens a consultancy profile (services, positioning) → decides to start a conversation.

**Journey C — Start Engagement**
User describes their problem in conversation → Lead Consultant asks discovery questions → Lead Consultant proposes Scope of Work → user approves (or requests edits) → Engagement is created.

**Journey D — Consultancy Executes Work**
Engagement created → Lead Consultant determines which subagents/skills/tools are needed → work is performed (possibly across multiple conversational turns) → Deliverable is produced and presented → user reviews → (approve → complete) or (request changes → loop back).

**Journey E — Modify Consultancy**
Creator returns to Agent Architect → edits services, subagents, skills, or tools → republishes updated consultancy version → (open question: does this affect *in-flight* engagements? see §13).

---

## 9. Conceptual data model

**Core entities:**

- **Creator** — the person who builds consultancies. `id, name, profile`
- **Consultancy** — `id, creator_id, name, description, services[], status(draft/published), lead_agent_id, subagent_ids[], created_at, updated_at`
- **Agent** — generic building block. `id, type(lead/subagent), consultancy_id, instructions, skill_ids[], tool_ids[]`
- **Skill** — `id, name, description, instructions/playbook, applicable_stage(optional: intake/execution/delivery), owner(consultancy_id or creator_id)`
- **Tool/MCP** — `id, name, connection_config, attached_to(agent_id or consultancy_id)`
- **User** — the client/end user. `id, name, profile`
- **Conversation** — `id, user_id, consultancy_id, messages[], status(discovery/scoped/executing/closed)`
- **ScopeOfWork** — `id, conversation_id, problem_statement, deliverables[], out_of_scope[], status(proposed/approved/edited), approved_at`
- **Engagement** *(recommended unifying entity — see §12 for why to collapse task/project/case)* — `id, consultancy_id, user_id, scope_of_work_id, type(task/project), status(active/awaiting_review/complete), created_at`
- **Deliverable** — `id, engagement_id, content/artifact_ref, produced_by(agent_id), delivered_at, status(pending_review/approved/revision_requested)`

**Relationships, plainly:**
- A Consultancy has one Lead Agent and many Subagents.
- Agents (lead or sub) have many Skills and many Tools.
- A Conversation belongs to one User and one Consultancy, and produces one ScopeOfWork.
- An approved ScopeOfWork creates exactly one Engagement.
- An Engagement produces one or more Deliverables.
- Skills and Tools can be reused across multiple Agents within the same Consultancy (many-to-many), but are not shared *across* different creators' consultancies in V1.

---

## 10. Agent Architect: new requirements

Minimum new capabilities Agent Architect needs to go from "build a persona" to "build a consultancy":

**P0 (must-have for V1):**
1. **Consultancy framing prompt/flow** — instead of "describe your agent's personality," ask "what expertise are you turning into a consultancy, and what services will you offer?"
2. **Service → subagent suggestion** — given a list of services, suggest a subagent per service area (creator can accept/reject/merge).
3. **Intake/discovery instruction template** — auto-generate a starting system prompt for the lead consultant that includes a discovery-question pattern and SoW-proposal pattern, so creators don't have to write this from scratch.
4. **Scope of Work template generator** — a reusable structure (problem statement / deliverables / out-of-scope) the lead agent fills in per conversation; Agent Architect should let the creator customize this template per consultancy (e.g. a fitness consultancy's SoW fields differ from a career consultancy's).
5. **Pre-publish coverage check** — verify every listed service maps to at least one subagent/skill capable of addressing it; flag gaps to the creator.

**P1 (important, can trail P0 slightly):**
6. **Testing/preview mode** — let the creator simulate a user conversation with their consultancy before publishing (this doubles as manual eval).
7. **Deliverable template guidance** — suggest what a "good deliverable" looks like per service type (e.g. workout plan structure vs. resume review structure).

**P2 (explicitly defer):**
8. Consultancy-level analytics/strategy advice ("your positioning is too broad, narrow it")
9. Automated subagent/skill generation from uploaded documents (e.g. "upload your existing coaching materials and we'll build skills from them") — powerful, but a distinct large feature, not required to prove the core loop.

---

## 11. Evals-first strategy for V1

**What to evaluate — three distinct layers:**

1. **Consultancy creation quality** (does Agent Architect produce a coherent, functional consultancy from creator input?)
2. **Intake/scoping quality** (does the lead consultant discover the right info and produce an accurate, appropriately-bounded SoW?)
3. **Execution/routing quality** (does the lead consultant route to the correct subagent/skill, and does the deliverable actually match the SoW?)

**Golden dataset structure** — for each layer, define `Input → Expected/Golden Output → Evaluation Criteria`.

**Example eval case — Layer 1 (Consultancy creation):**
- Input: Creator description — *"I'm a certified nutritionist who helps busy professionals lose weight without giving up eating out."*
- Golden output: A consultancy with services including at minimum "nutrition planning" and "eating-out-compatible meal guidance"; at least one subagent addressing nutrition; lead agent instructions reference discovery-before-advice pattern.
- Evaluation criteria: services list is specific (not generic "health coaching"); at least 1 relevant subagent suggested; pre-publish coverage check passes (no unaddressed service).

**Example eval case — Layer 2 (Intake/scoping):**
- Input: User message — *"I want to lose 15 lbs before my wedding in 4 months but I travel for work constantly."*
- Golden output SoW: problem statement captures both the weight goal *and* the travel constraint; deliverables include a plan type (e.g. "travel-friendly meal + workout plan"); out-of-scope explicitly excludes things like medical/clinical weight-loss advice.
- Evaluation criteria: SoW mentions the travel constraint explicitly (tests whether discovery actually listened, not just templated); deliverable type matches what's actually being asked; out-of-scope boundary is present (tests the "acts like a consultancy" bar, not just "answers the question").

**Example eval case — Layer 3 (Execution/routing):**
- Input: Approved SoW from above example.
- Golden output: Nutrition Agent is invoked for meal planning; Workout Agent (if exists) invoked for travel-friendly workouts; final deliverable references both the wedding deadline and travel constraint.
- Evaluation criteria: correct subagent(s) invoked (routing accuracy); deliverable content traceable back to SoW deliverables (no scope drift); deliverable is concrete/actionable, not generic advice.

**Scoring approach for V1 (keep it simple):**
- Binary pass/fail per criterion, aggregated into a per-case pass rate — avoid building a fancy weighted-scoring system for the first cut.
- Run these offline (dev-time), not against live user traffic, per the explicit "evals first" instruction.
- Gate: a consultancy template/change should hit a defined pass rate (e.g. "80% of golden cases pass") before Agent Architect changes ship.

**Which journeys need eval coverage first (priority order):** Journey A (creation) and Journey C (scoping) are the highest-leverage layers to eval first, since they're upstream of everything else — a bad SoW guarantees a bad deliverable regardless of how good subagent routing is.

---

## 12. Prioritized roadmap

**P0 — absolutely required to ship V1 (prove the core loop):**
- Consultancy entity + creation flow (name, services, positioning)
- Lead agent creation (reuse existing agent creation, framed as "lead consultant")
- Subagent creation (manual is fine; AI-suggested subagents strongly recommended here too, it's cheap and high-value)
- Skill + Tool/MCP attachment (reuse existing mechanics)
- Marketplace listing at the consultancy level
- Conversation → discovery → SoW proposal → SoW approval flow
- **Single unified Engagement object** (not three separate Task/Project/Case types — collapse to one entity with an optional `type` field; splitting this into three real object types on day one is scope creep that doesn't serve proving the loop)
- Execution routing (prompt-driven, using existing lead/subagent/skill primitives — no new orchestration engine)
- Deliverable presentation + completion status
- Offline eval dataset + gating process for Agent Architect changes (per explicit evals-first instruction)

**P1 — important, do shortly after P0 proves out:**
- Pre-publish coverage check in Agent Architect
- Preview/test-conversation mode for creators before publishing
- Revision loop (request changes → re-execution) on deliverables
- Distinguishing task vs. project as a lightweight `type` field with slightly different UX treatment (e.g. projects show a milestone list) — *without* building them as separate backend objects

**P2 — later, post-V1 validation:**
- Case as a genuinely distinct third engagement type (only if user research shows task/project isn't sufficient)
- Consultancy analytics for creators
- Creator-to-creator skill/subagent reuse marketplace
- Automated skill generation from uploaded materials
- Any billing/monetization flow (pending explicit product decision)
- V2 external deployment (website generation, custom domains) — out of scope by definition

**Why this ordering**: the fastest way to know if "AI consultancy" beats "AI persona" is to get one creator through Journey A and one user through Journeys B–D with a real SoW and real deliverable. Everything else is refinement on top of a validated loop.

---

## 13. Open questions — ask Naman before building

1. **Task vs. Project vs. Case**: is "Case" meant to be a third distinct engagement type, or is it just the casual/umbrella word Naman used for "engagement" in general? The transcript uses "task ya project" in one place and "case" separately elsewhere — this needs a definitive answer before deciding the data model (§9, §12 assume you can collapse to one entity, but confirm).
2. **Monetization**: is there any payment/billing expectation in V1, or is this purely functional validation with no money changing hands yet? Nothing in the source material mentions pricing.
3. **Updating a published consultancy**: when a creator edits subagents/skills after publishing, does it affect in-flight engagements immediately, or only new engagements going forward?
4. **Subagent visibility to the user**: does the end user ever see/know they're talking to a subagent, or does everything stay abstracted behind the lead consultant's single conversational thread?
5. **Cross-consultancy reuse**: can a creator reuse a skill/subagent they built in one consultancy inside another consultancy of theirs? (Not asking about cross-creator reuse — that's clearly P2 — just same-creator reuse.)
6. **What counts as "coverage" for the pre-publish check**: is a single generic subagent allowed to cover multiple services, or does the check require a more granular 1:1 mapping?
7. **Discovery length**: is there a target for how many discovery questions/turns before a SoW should be proposed, or is this left entirely to the lead agent's judgment per consultancy?
8. **Deliverable format**: should deliverables be free-form (whatever the agent generates) or should V1 constrain them to a known set of formats (doc, plan, checklist) for easier eval and UI rendering?
9. **Moderation**: does the existing marketplace moderation tooling extend automatically to consultancies, or does it need new review criteria (e.g. reviewing whether a consultancy's SoW template and services are appropriate)?

Do not assume answers to these — they materially change the data model and roadmap.

---

## 14. One-page mental model (keep this beside you)

**What it is**: A platform where an expert builds an AI-run consultancy firm (not a single chatbot persona) using Agent Architect, and publishes it to a marketplace where users open scoped engagements with it and receive real deliverables.

**The org chart**: Consultancy → Lead AI Consultant → Subagents → Skills → Tools/MCPs.

**The engagement flow**: Conversation (discovery) → Scope of Work (approved) → Engagement (task/project) → Execution (lead routes to subagents/skills) → Deliverable → Review → Complete.

**What changed vs. old "AI Persona" product**: the top-level object became a firm (many agents + explicit scoping + deliverables) instead of one persona; Agent Architect gained consultancy-framing capabilities; the interaction model gained an explicit scoping/deliverable structure instead of open-ended chat.

**What's explicitly V2, not V1**: any external website generation or deployment outside the platform.

**Development method**: evals-first — golden input/output datasets per journey (creation, scoping, execution) gate every Agent Architect change; nothing ships without passing its eval set.

**Biggest scope-creep risk to watch**: building Task, Project, and Case as three separate first-class objects/flows on day one. Collapse to one Engagement entity with a type flag until real usage proves you need three.

**North star for V1**: prove that "talk to a firm, get scoped work, get a real deliverable" beats "talk to a persona indefinitely" — for one creator and one real user problem, end to end.
