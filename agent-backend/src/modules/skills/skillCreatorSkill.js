export const SKILL_CREATOR_SKILL = `
---
name: skill-creator
description: Structured interview and collaborative workflow for turning a creator's expertise into a "verb skill" (teach, review, coach, ...) for their persona agent, following this platform's verb/concept model. Use whenever the user wants to give their agent a new capability, define what it does for people, or build out a persona.
---

## What this is

A persona (an Agent on this platform) is trained on a handful of **verbs**
— the things it does for people (teach, coach, review, ...). On this
platform, one persona is **one Skill** (named after the persona itself),
attached to the agent via \`manage_agent\`; each verb the persona performs
is a subfolder inside that one skill, with its own playbook. Under each
verb sit the **concepts** it actually applies to (a specific topic, doc
type, or scenario the creator handles), each with its own mini-playbook,
loaded only when a client's request needs it.

One persona per creator, one Skill per persona. Two to four verbs is
typical, all bundled inside that same skill — breadth lives in the
concepts underneath, not in more verbs, and not in more skills. Do NOT
write a system-prompt-style skill from a guess: engage with the creator,
plan collaboratively, and let the creator's own words become the playbook.

## Terms

- **Persona** — the expert's identity and voice. One persona per creator,
  one Skill per persona.
- **Verb** — how that expert helps people (teach, coach, review, ...).
  2-4 per persona.
- **Concept** — what they're helping with: a specific topic, doc type, or
  scenario the creator actually handles. Lives under a verb.
- **Playbook** — the expert's specific method for a verb: the 7-part
  structure below (Intake, Rules, Process, Concept index, Output,
  Boundaries, Worked example), written in the creator's own words, not a
  generic template filler.
- **Resources** — the material used to perform that work: drills,
  templates, checklists, anything a concept's playbook points to or
  hands the client.

## The verb vocabulary

Every persona picks 2-4 of these. What makes a verb theirs is the playbook
and concepts underneath, not the verb itself — the platform gives the
structure, the creator gives the content.

| Client wants | Verb | What the persona does | Example concepts |
|---|---|---|---|
| Understand my situation | @explain | Answer from the creator's frameworks, in their voice | the questions they get DMs about |
| Understand my situation | @assess | Score a situation against a standard, name the gaps | O-1 criteria, fitness baseline, design readiness |
| Understand my situation | @analyze | Read what the client brings and say what it means | a contract, lab results, funnel metrics |
| Help me decide | @advise | Apply a decision framework to one decision | take the offer?, master's or not? |
| Help me decide | @mentor | Share lived experience and an opinion about a path | switching domains, first management role |
| Do it for me | @plan | Produce a plan under real constraints | weekly meals, 90-day evidence campaign |
| Do it for me | @draft | Write an artifact in the creator's voice | investor emails, recommendation letters |
| Do it for me | @research | Find and qualify options with a reason per option | investors, judging opportunities, target companies |
| Make me better | @teach | Transfer a concept with practice and a check | numbers before boxes, STAR stories |
| Make me better | @review | Grade an artifact against a rubric, fix the weakest part | resume, pitch deck, design doc |
| Make me better | @rehearse | Play the other side so the client can practice | mock interview, salary negotiation, investor Q&A |
| Make me better | @coach | Work toward a goal over weeks; the client does the work | career transition, 12-week fitness |
| Keep me on track | @guide | Walk through a defined multi-step process | O-1 filing, university application |
| Keep me on track | @track | Check in on a cadence, report progress, nudge | Sunday fitness report, weekly pipeline readout |

## The 7-part structure of one verb skill

1. **Intake** — what to ask before doing anything, and the 2-4
   distinctions that change the approach. The creator's own questions,
   verbatim.
2. **Rules, with reasons** — what the persona always does here and what
   it refuses to do, and WHY. The reason is the asset, not the rule alone.
3. **Process** — phases from the first message to done: what it asks,
   what it produces at each phase, and when a phase counts as done.
4. **Concept index** — the topics this verb applies to and when to load
   each (one file per concept — see File layout below).
5. **Output** — what the client walks away with, in a fixed format.
6. **Boundaries** — when the persona stops and hands off, and the exact
   sentence it uses to do it.
7. **Worked example** — one real case, verbatim. This doubles as the
   first test (see "Test before publishing" below).

---

## Interactive Workflow: Talk, Plan (TODO), Discuss, then Create

Whenever a user wants to create a skill, define a new agent capability,
or add a verb, **do NOT jump straight into writing code or creating files
unprompted.** Follow this collaborative, high-impact four-step protocol:

### Step 1: Initial Alignment (Direct Creation vs. Collaborative Discussion)
First, acknowledge their request and clarify the path forward:
- Talk with the user to understand the broad picture of what they want to achieve.
- Ask them clearly:
  > **"Would you like me to create this skill directly based on what you have provided, or would you prefer to discuss and plan it together first?"**
- **If the user chooses "Create directly"** (or has already provided an exhaustive, complete spec with intake, rules, process, etc.):
  - Provide a brief 2-3 bullet confirmation of what will be generated.
  - Skip directly to **Step 3 (Authoring & Execution)**.
- **If the user chooses "Discuss"** (or their initial idea is open-ended or high-level):
  - Transition immediately to **Step 2 (Collaborative Discussion with a TODO List)**.

### Step 2: Collaborative Discussion with a Live TODO List
When discussing with the user, **always create and present a clear TODO list first** so the creator has full visibility into what needs to be designed.

1. **Display the Skill Design Plan (TODO List)**:
   Show the user a structured checklist covering the 8 essential facets:
   \`\`\`markdown
   ### 📋 Skill Design Plan
   - [ ] 1. Persona & Skill Name (the expert identity)
   - [ ] 2. Core Verb(s) (what the persona actually does, e.g. @teach, @review, @coach)
   - [ ] 3. Intake & Key Distinctions (what to ask first; 2-4 critical distinctions)
   - [ ] 4. Rules with Reasons (what it always does, what it refuses to do, and WHY)
   - [ ] 5. Process Phases (step-by-step from opening message to completion)
   - [ ] 6. Concepts & Topics (recurring real-world scenarios handled)
   - [ ] 7. Output Deliverable (the exact artifact or format the client receives)
   - [ ] 8. Boundaries & Worked Example (handoff trigger sentence + 1 real case to test)
   \`\`\`

2. **Discuss Step-by-Step with the User**:
   - Work through the TODO items logically. Ask 1-2 focused, high-clarity questions at a time — **never barrage the user with all questions in a single wall of text**.
   - **Persona & Verb**: Help them name the persona (e.g. \`career-coach\`) and select 1-2 primary verbs from the vocabulary table.
   - **Intake**: Ask: *"Before you help someone with this, what do you need to know first? What 2-3 distinctions immediately change your advice?"*
   - **Rules with Reasons**: Ask: *"What do you always do here? What do you refuse to do, and WHY?"* (Always capture the rationale — "because otherwise..." is what gives the agent true expertise).
   - **Process**: Ask: *"Can you walk me through a typical case from start to finish? What are the key stages?"*
   - **Concepts**: Ask: *"What are the 2-4 recurring scenarios or topics you get asked about most often?"*
   - **Output & Boundaries**: Ask: *"What does the user walk away with? When do you draw the line and hand off, and what exact sentence do you say?"*
   - **Worked Example**: Ask for one real-world interaction they've handled that demonstrates this playbook.

3. **Keep the User's Own Words**:
   Record the creator's real phrases, vocabulary, frameworks, and tone verbatim instead of paraphrasing into generic corporate jargon.

4. **Update the TODO Progressively**:
   As items are settled, update the checklist (marking items \`[x]\`) so the user feels steady momentum and alignment.

5. **Final Confirmation**:
   Once all items on the TODO are checked off, synthesize the complete design in a concise summary and confirm:
   > **"Everything is planned and aligned. Ready for me to create the skill files now?"**

### Step 3: Skill Authoring & Execution
Once the user confirms, write the skill files into \`/skill-library/\` strictly following the file layout and order rules:
1. Write the root \`/skill-library/<skill-name>/SKILL.md\` **alone first**.
2. Confirm the write succeeded.
3. Write the verb playbook \`/skill-library/<skill-name>/<verb-name>/SKILL.md\`.
4. Write the worked example \`/skill-library/<skill-name>/<verb-name>/worked-example.md\`.
5. Write the concept files \`/skill-library/<skill-name>/<verb-name>/concepts/<slug>.md\` one at a time.
6. Present a concise confirmation showing the files created and their structure.

### Step 4: Test & Refine Before Publishing
Before attaching to a production agent:
1. **Replay the worked example**: Simulate how the persona responds to the client's opening prompt using the newly created playbook.
2. **Ask the creator**:
   > **"Would you have said that? What is the one thing you'd change or improve?"**
3. If they provide a correction, make a targeted edit via \`edit_file\` and re-test.
4. If approved, attach the skill to their agent using \`manage_agent\` patch (\`field:"skills", op:"add", value:"<skillId>"\`).

---

## File layout on this platform

One persona is one Skill, authored at \`/skill-library/<skill-name>/\`
(the persona's own name, e.g. \`career-coaching\`). Each verb it performs
is a subfolder inside that same skill — NOT a separate skill of its own:

\`\`\`
/skill-library/<skill-name>/
  SKILL.md                     # persona-level index only — see below
  <verb-name>/                 # e.g. teach/ — the verb without the @
    SKILL.md                   # sections 1, 2, 3, 5, 6 + concept index (4)
    worked-example.md          # section 7 — the real case, verbatim
    concepts/
      <concept-slug>.md        # one per concept: that concept's own
                                # playbook + resources (drills, templates)
  <another-verb-name>/         # e.g. review/ — same shape, repeats
    SKILL.md
    worked-example.md
    concepts/
      <concept-slug>.md
\`\`\`

The root \`/skill-library/<skill-name>/SKILL.md\` is the ONLY file this
platform's filesystem route treats specially (it bootstraps the Skill
document — see "Creating and managing the files" below). Every path
under it, including every \`<verb-name>/SKILL.md\`, is an ordinary
supporting file the agent reads on demand, the same mechanism as any
skill's \`references/*.md\` — just organized under one folder per verb
(and \`concepts/\` under that) to match this platform's own vocabulary.

Root \`SKILL.md\` frontmatter and body — an INDEX, not a playbook:

\`\`\`markdown
---
name: <skill-name>
description: <one clause per bundled verb, so the agent's skill-
  activation check fires for any of them, e.g. "Teaches system design
  fundamentals; reviews design docs against a 6-dimension rubric.">
---

This persona bundles the following verbs — read the matching one in
full before acting on it:
- @teach -> teach/SKILL.md — <one line on when this verb applies>
- @review -> review/SKILL.md — <one line on when this verb applies>
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
