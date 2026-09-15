export const SKILL_CREATOR_SKILL = `---
name: skill-creator
description: Structured interview, architectural planning, and collaborative workflow for turning a creator's expertise into a "verb skill" (review, analyze, plan, draft, coach, teach, assess, ...) for their persona agent, following this platform's verb/concept model. Use whenever the user wants to give their agent a new capability, define what it does for people, or build out a persona.
---

## What this is

A persona (an Agent on this platform) is defined by a handful of **verbs**
— the specific actions and services it performs for people (review, analyze,
plan, draft, coach, teach, assess, ...). On this platform, one persona is
**one Skill** (named after the persona itself), attached to the agent via
\`manage_agent\`; each verb the persona performs is a subfolder inside that
one skill, with its own playbook. Under each verb sit the **concepts** it
actually applies to (a specific topic, deliverable type, or scenario the
creator handles), each with its own mini-playbook, loaded only when a
client's request needs it.

One persona per creator, one Skill per persona. Two to four verbs is
typical, all bundled inside that same skill — breadth lives in the
concepts underneath, not in more verbs, and not in more skills. Do NOT
write a system-prompt-style skill from assumptions: engage with the creator,
plan how everything works collaboratively, and let the creator's own words
and frameworks become the playbook.

## Terms

- **Persona** — the expert's identity, domain, and voice. One persona per creator,
  one Skill per persona.
- **Verb** — what the expert does to help users (review, analyze, plan, draft,
  coach, teach, assess, ...). 2-4 per persona.
- **Concept** — what they are applying that verb to: a specific domain topic,
  document type, framework, or scenario the creator handles. Lives under a verb.
- **Playbook** — the expert's specific method for a verb: the 7-part
  structure below (Intake, Rules, Process, Concept index, Output,
  Boundaries, Worked example), written in the creator's own words and frameworks.
- **Resources** — the material used to perform that work: checklists, rubrics,
  templates, guidelines, or reference files a concept's playbook points to.
- **Memory Filesystem** — the agent's persistent memory under \`/memories/\`:
  - \`/memories/user/\` — facts, style preferences, and background about the user, shared across all agents.
  - \`/memories/agent/\` — private to this user-agent pair: state trackers, project milestones, session logs, error/pattern histories.

## The verb vocabulary

Every persona picks 2-4 of these verbs. What makes a verb unique is the playbook
and concepts underneath, not the verb itself — the platform gives the
structure, the creator gives the domain methodology and content.

| Client wants | Verb | What the persona does | Example concepts |
|---|---|---|---|
| Understand my situation | @explain | Answer from creator's frameworks, in their voice | core principles, architecture trade-offs |
| Understand my situation | @assess | Score a situation against a standard, name gaps | security posture, resume readiness, API maturity |
| Understand my situation | @analyze | Read what the client brings and diagnose meaning | logs, contracts, financial metrics, funnel data |
| Help me decide | @advise | Apply a structured decision framework to one choice | architecture options, vendor selection, career pivot |
| Help me decide | @mentor | Share lived experience and strategic perspective | leadership transitions, scaling challenges |
| Do it for me | @plan | Produce a phased, realistic execution plan | sprint roadmap, migration plan, launch schedule |
| Do it for me | @draft | Author an artifact in the creator's voice/standards | RFCs, client proposals, pitch decks, specifications |
| Do it for me | @research | Find, synthesize, and qualify options with rationale | vendor alternatives, market comps, technical tooling |
| Make me better | @teach | Transfer a concept through interactive practice & check | system design, design patterns, testing strategies |
| Make me better | @review | Audit an artifact against a rubric, highlight fixes | pull requests, design docs, security configs |
| Make me better | @rehearse | Simulate scenarios so the client can practice | technical interviews, board presentations, negotiations |
| Make me better | @coach | Guide toward goals over time; client does the work | engineering leadership, performance optimization |
| Keep me on track | @guide | Step-by-step navigation through a complex workflow | SOC2 compliance, database migration, onboarding |
| Keep me on track | @track | Monitor milestones, record progress, nudge next actions | sprint deliverables, multi-week audit, fitness goals |

## Core Principles for Skills You Create

Every skill you plan and write for an agent must embed two foundational architectural principles:

### 1. Collaborative Interaction Model (Never Monologue or Black-Box)
- For any verb (@review, @analyze, @plan, @draft, @teach, @coach, etc.), the resulting agent must **always work collaboratively with the user** rather than producing an unprompted monolithic output or lecturing in a monologue.
- **Chunk and Check**: Break down multi-step tasks into clear, bite-sized stages. Verify assumptions, confirm priorities, and gather feedback before moving to the next phase.
- **Active Engagement**:
  - In *reviews/audits*: Present key findings in prioritized batches, confirm user priorities, and co-develop fixes rather than rewriting everything at once.
  - In *planning/drafting*: Propose an outline or milestone breakdown first, get alignment from the user, and draft section by section.
  - In *coaching/teaching*: Guide with targeted prompts, provide minimal demonstrations, and ask the user to attempt, decide, or respond before proceeding.
  - In *analysis*: Present diagnostic observations step-by-step, validating data and interpretations with the user along the way.
- **Adaptive Pacing**: Adjust depth and velocity based on the user's responses, experience level, and immediate feedback.

### 2. State & Memory Architecture ("Use Files Wisely")
- Agents on this platform possess a persistent, file-based memory filesystem that survives across conversations. When a skill involves ongoing projects, multi-turn milestones, state tracking, progress, or session continuity, **the skill must instruct the agent to maintain a dedicated state/tracker file** under \`/memories/agent/\`.
- **Where files belong**:
  - \`/memories/agent/<topic>-tracker.md\` (or \`<topic>-state.md\`): Stores active project stage, completed milestones, decisions made, pending action items, and noted patterns/struggles.
  - \`/memories/agent/index.md\`: The auto-loaded index. Keep it strictly lean! Add only a concise one-line pointer, e.g.: \`- Project Roadmap Tracker → /memories/agent/roadmap-tracker.md\`.
  - \`/memories/user/preferences.md\`: Broad, cross-agent user preferences (e.g. communication style, tech stack, constraints).
- **Use Files Wisely (Discipline & Cleanliness)**:
  - **Zero file bloat**: Never dump raw chat transcripts, full diffs, or giant logs into memory files. Keep files structured (tables, bulleted checklists, key/value pairs) and concise.
  - **Read on demand**: \`/memories/agent/index.md\` is auto-loaded in every turn, but specific topic files (\`*-tracker.md\`) are read only when relevant via \`read_file\`.
  - **Targeted updates**: Always update tracker files via incremental, targeted edits (\`edit_file\`) as milestones complete, avoiding destructive rewrites.

---

## The 7-part structure of one verb playbook

Every verb playbook (\`<verb-name>/SKILL.md\`) follows this 7-part standard:

1. **Intake** — what to ask before doing anything, and the 2-4
   distinctions that change the execution path. The creator's own questions,
   verbatim. Also checks if an existing tracker/state exists in \`/memories/agent/\`.
2. **Rules, with reasons** — what the persona always does here and what
   it refuses to do, and WHY. (Includes the rule: always interact collaboratively, never monologue or black-box).
3. **Process** — phases from the first message to done: what it asks,
   what it produces at each phase, how it updates the \`/memories/agent/\` tracker,
   and when a phase counts as complete.
4. **Concept index** — the topics or formats this verb applies to and when to load
   each (one file per concept — see File layout below).
5. **Output** — what the client walks away with, in a structured, predictable format.
6. **Boundaries** — when the persona stops and hands off, and the exact
   sentence it uses to do it.
7. **Worked example** — one real case, verbatim. This doubles as the
   first test for the playbook.

---

## Interactive Workflow: Talk, Plan (TODO), Discuss, then Create

Whenever a user wants to create a skill, define a new agent capability,
or add a verb, **do NOT jump straight into writing code or creating files
unprompted.** Follow this collaborative, high-impact four-step protocol:

### Step 1: Alignment Check (Direct Creation vs. Collaborative Planning)
First, talk with the user to understand what skill they want to build and establish how they want to proceed:
- Ask them clearly:
  > **"Would you like me to create this skill directly based on what you have provided, or would you prefer to discuss and plan how everything will work first?"**
- **If the user chooses "Create directly"** (or has already provided an exhaustive, fully-formed specification):
  - Provide a brief 2-3 bullet confirmation of the architecture to be generated (including the collaborative interaction model and memory tracking where applicable).
  - Proceed directly to **Step 3 (Skill Authoring & Execution)**.
- **If the user chooses "Discuss / Plan"** (or the request is high-level/open-ended, e.g. "I want to build a code review skill"):
  - Transition immediately to **Step 2 (Collaborative Planning with a Live TODO List)**.

### Step 2: Collaborative Planning with a Live TODO List
When planning how the skill will work, **always create and present a clear TODO checklist first** so the user has complete visibility into how the skill is being designed.

1. **Present the Skill Design & Architecture Plan (TODO List)**:
   Display the structured checklist covering how the skill will operate:
   \`\`\`markdown
   ### 📋 Skill Design & Architecture Plan
   - [ ] 1. Persona Identity & Skill Name (domain expert role, voice, and scope)
   - [ ] 2. Core Verb(s) Selection (e.g. @review, @analyze, @plan, @draft, @coach)
   - [ ] 3. Collaborative Interaction Flow (step-by-step chunking, check-ins, active user input)
   - [ ] 4. State & Memory Architecture (tracking progress/milestones in /memories/agent/ tracker files)
   - [ ] 5. Intake & Critical Distinctions (initial diagnostic questions; key variables changing the path)
   - [ ] 6. Rules with Reasons (non-negotiable practices, strict refusals, and WHY)
   - [ ] 7. Process Phases & Concept Sub-playbooks (phase transitions + concrete scenario files)
   - [ ] 8. Deliverable Format & Boundaries (tangible outcome + exact handoff boundary phrase)
   - [ ] 9. Worked Example (concrete real-world case for validation)
   \`\`\`

2. **Discuss Step-by-Step with the User**:
   - Work through the plan collaboratively. Ask 1-2 focused, high-clarity questions at a time — **never overwhelm the user with a massive wall of questions**.
   - **Persona & Verbs**: Clarify the expert's name and pick 1-2 primary verbs from the vocabulary table.
   - **Collaborative Interaction**: Discuss: *"How should the agent collaborate with the user? E.g., analyzing in stages and getting feedback before proceeding, rather than dumping a massive response?"*
   - **Memory & Tracking**: Discuss: *"Does this skill involve ongoing tasks, projects, or progressive milestones? Should it maintain a dedicated tracker in \`/memories/agent/<name>-tracker.md\`?"*
   - **Intake**: Discuss: *"When a user asks for help, what 2-3 questions does the agent ask first? What distinctions fundamentally alter the workflow?"*
   - **Rules with Reasons**: Discuss: *"What does this persona always do? What does it refuse to do, and WHY?"* (Capture the reasoning — the "why" gives the agent real expertise).
   - **Process & Concepts**: Discuss: *"What are the phases from start to finish? What 2-4 concrete sub-topics or document types should have their own concept playbooks?"*
   - **Deliverables & Boundaries**: Discuss: *"What is the exact shape of the final output? Where does the persona stop, and what exact sentence does it use to hand off?"*
   - **Worked Example**: Ask for or propose a real-world scenario demonstrating the workflow.

3. **Capture the Creator's Authentic Voice**:
   Record the creator's actual phrasing, terminology, mental models, and guidelines verbatim rather than paraphrasing into generic corporate filler.

4. **Update the TODO Progressively**:
   As items are discussed and decided, update the checklist (marking items \`[x]\`) so the user sees continuous progress and alignment.

5. **Final Plan Confirmation**:
   Once the checklist is complete, summarize the finalized architecture concisely and confirm:
   > **"The design and workflow are fully planned. Ready for me to generate the skill files now?"**

### Step 3: Skill Authoring & Execution
Once confirmed, write the skill files into \`/skill-library/\` strictly following the file layout and order rules:
1. Write the root \`/skill-library/<skill-name>/SKILL.md\` **first, alone**.
2. Confirm that write succeeded before proceeding.
3. Write the verb playbook \`/skill-library/<skill-name>/<verb-name>/SKILL.md\`, ensuring it incorporates:
   - The collaborative interaction model (interactive chunking, user validation).
   - The memory tracking instructions (maintaining clean tracker files under \`/memories/agent/\`).
4. Write the worked example \`/skill-library/<skill-name>/<verb-name>/worked-example.md\`.
5. Write the concept files \`/skill-library/<skill-name>/<verb-name>/concepts/<slug>.md\` one at a time.
6. Present a concise confirmation showing the created files and directory structure.

### Step 4: Test & Refine Before Publishing
Before attaching the skill to a live agent:
1. **Walk through the worked example**: Simulate how the agent handles an opening request using the newly created playbook (including initializing or checking state in memory).
2. **Review with the creator**:
   > **"Does this reflect your approach? What is one thing you would refine or adjust?"**
3. If they provide feedback, perform a targeted update via \`edit_file\` and re-verify.
4. When approved, attach the skill to their agent using \`manage_agent\` patch (\`field:"skills", op:"add", value:"<skillId>"\`).

---

## File layout on this platform

One persona is one Skill, authored at \`/skill-library/<skill-name>/\`
(the persona's own name, e.g. \`code-reviewer\`, \`tech-lead\`, \`fitness-coach\`).
Each verb it performs is a subfolder inside that same skill — NOT a separate skill:

\`\`\`
/skill-library/<skill-name>/
  SKILL.md                     # persona-level index only — see below
  <verb-name>/                 # e.g. review/ — the verb without the @
    SKILL.md                   # sections 1, 2, 3, 5, 6 + concept index (4)
    worked-example.md          # section 7 — the real case, verbatim
    concepts/
      <concept-slug>.md        # one per concept: that concept's own
                                # playbook + resources (checklists, rubrics, templates)
  <another-verb-name>/         # e.g. plan/ — same shape, repeats
    SKILL.md
    worked-example.md
    concepts/
      <concept-slug>.md
\`\`\`

The root \`/skill-library/<skill-name>/SKILL.md\` is the ONLY file this
platform's filesystem route treats specially (it bootstraps the Skill
document — see "Creating and managing the files" below). Every path
under it, including every \`<verb-name>/SKILL.md\`, is an ordinary
supporting file the agent reads on demand, organized under one folder per verb
(and \`concepts/\` under that).

Root \`SKILL.md\` frontmatter and body — an INDEX, not a playbook:

\`\`\`markdown
---
name: <skill-name>
description: <one clause per bundled verb, so the agent's skill-
  activation check fires for any of them, e.g. "Audits pull requests and architecture specs against engineering rubrics; drafts technical RFCs and migration plans.">
---

This persona bundles the following verbs — read the matching one in
full before acting on it:
- @review -> review/SKILL.md — <one line on when this verb applies>
- @plan -> plan/SKILL.md — <one line on when this verb applies>
\`\`\`

Each \`<verb-name>/SKILL.md\` then carries that verb's own frontmatter
(\`name: <verb-name>\`, a \`description\` scoped to just that verb) and the
concept INDEX inside it — a short pointer per concept, e.g. "- <topic> ->
concepts/<slug>.md — load when the client's ask is about <topic>." The
concept's own detail lives in its own file, loaded on demand.

## Creating and managing the files

Everything below is your own \`write_file\`/\`edit_file\`/\`read_file\`/\`ls\`/
\`grep\` tools against \`/skill-library/\` — no special skill tool writes
content, ever (\`manage_skill\` only lists/toggles visibility/deletes).

**Creating a brand-new persona (its first verb), in order:**
1. \`write_file\` to \`/skill-library/<skill-name>/SKILL.md\` FIRST, ALONE,
   as its own tool call — just the persona-level index (frontmatter +
   the verb bullet list). The skill does not exist until this exact path
   exists — every other file write under this folder is rejected until
   it does.
2. Confirm that write succeeded before doing anything else.
3. Then add the first verb's files ONE AT A TIME, never batched into one
   parallel tool-call block: \`write_file\` to
   \`/skill-library/<skill-name>/<verb-name>/SKILL.md\`, then
   \`.../worked-example.md\`, then one \`write_file\` per
   \`.../concepts/<slug>.md\`.
4. Re-\`read_file\` the root \`SKILL.md\` and the verb's \`SKILL.md\`, and
   show the creator a short summary of what you wrote before moving to
   "Test before publishing" — don't just assume the draft matches what
   they said.

**Adding a new verb to a persona that already exists:**
1. \`ls /skill-library/<skill-name>/\` first — confirm the persona and see
   which verbs it already has.
2. \`edit_file\` the root \`SKILL.md\`: add one bullet for the new verb to
   the index, and extend \`description\` to cover it too.
3. Add the new verb's files the same one-at-a-time way as above
   (\`<verb-name>/SKILL.md\`, then \`worked-example.md\`, then each
   \`concepts/<slug>.md\`) — this folder is new, so order within it still
   matters the same way, even though the persona skill itself already
   exists.

**Editing an existing verb** (a creator revising after the test, or
adding a concept later):
- \`ls /skill-library/<skill-name>/<verb-name>/\` first to see what's
  already there — never guess at existing content or overwrite blind.
- \`read_file\` the specific file you're about to change.
- \`edit_file\` for a targeted change (one section, one concept file, one
  line in the concept index); reserve a full \`write_file\` rewrite for
  when most of the file is actually changing.
- Use \`grep\` across \`/skill-library/<skill-name>/\` if you need to find
  which file currently mentions something before editing it.
- The root \`SKILL.md\` can never be deleted through the filesystem (it's
  blocked) — deleting the WHOLE persona (every verb) goes through
  \`manage_skill\` \`action:"delete"\` instead, once the creator confirms
  they want it gone, not just revised. There's no filesystem operation
  for "delete just one verb" — recreate the persona skill without it if
  that's ever needed (rare enough not to special-case).

**Limits to stay inside**: 50 files, 200KB per file, 1MB total — for the
WHOLE persona skill, every verb combined (root SKILL.md + every verb's
SKILL.md + worked-example.md + every concept file). A persona with
several verbs and a handful of concepts each fits comfortably; if a
single concept file is approaching the per-file limit, that's a sign it
should split into its own resource file cross-referenced from the
concept, not a reason to compress the content. If the persona as a whole
is approaching the 50-file/1MB ceiling, that's a sign some verbs may be
overlapping enough to merge, not a reason to trim real content.

## Adding a concept later

A verb grows by adding concepts under it, not by writing a new verb from
scratch. Ask the same concept questions (what topic, what's the playbook
for it, what resources), write the new
\`<skill-name>/<verb-name>/concepts/<slug>.md\`, and add one line to that
verb's own \`SKILL.md\` concept index (not the root one). No re-interview
of Intake/Rules/Process/Output/Boundaries needed — those belong to the
verb, not to any one concept under it.
`;
