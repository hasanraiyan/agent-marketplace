export const SKILL_CREATOR_SKILL = `---
name: skill-creator
description: Structured interview for turning a creator's expertise into a "verb skill" (teach, review, coach, ...) for their persona agent, following this platform's verb/concept model. Use whenever the user wants to give their agent a new capability, define what it does for people, or build out a persona — not for generic one-off skills unrelated to a persona's verbs.
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
write a system-prompt-style skill from a guess: run the interview below
and let the creator's own words become the playbook.

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

## How to run the interview

Never write a playbook from a guess or a generic template filler.
Interview the creator section by section, in this order, and use their
own words rather than paraphrasing them into something more generic.

0. **Name the persona** (first verb only). Ask what to call this persona
   — this becomes the skill-name (the top folder, e.g. \`career-coaching\`
   or the creator's own handle). Skip this step entirely when adding
   another verb to a persona that already exists.
1. **Pick the verb(s).** Ask what they actually do for people; match it
   to 1-4 verbs from the table above. Most personas need 2-4 — if they
   name more, ask which ones people actually come to them for most. When
   adding to an existing persona, this is just the one new verb.
2. **Intake.** Ask: "Before you help someone with this, what do you need
   to know first?" Capture their real questions verbatim, not a generic
   checklist. Then ask what 2-4 distinctions change how they'd approach
   it (e.g. "beginner vs. someone who's already shipped something").
3. **Rules, with reasons.** Ask: "What do you always do here? What do
   you refuse to do, and why?" Push for the reason every time — "because
   otherwise ___" is what makes a rule transferable instead of generic
   advice.
4. **Process.** Ask them to walk through one real case start to finish:
   what they ask, in what order, what they produce at each step, and how
   they know a phase is done.
5. **Concepts.** Ask what specific topics or situations this verb
   applies to for them — their actual recurring client requests, not
   abstractions. Each becomes one concept file. Don't over-collect: 2-5
   concepts to start is plenty; more can be added later the same way
   (see "Adding a concept later").
6. **Output.** Ask what the client walks away with, and in what shape —
   a doc, a score plus one fix, a plan, a redlined draft.
7. **Boundaries.** Ask: "When do you stop and hand off, and what do you
   say?" Get the exact sentence, not a paraphrase of it.
8. **Worked example.** Ask for one real case they've actually handled,
   in enough detail to replay it start to finish. This becomes both
   section 7 of the skill and the test in the next step.

Draft the whole \`SKILL.md\` (plus \`worked-example.md\` and the concept
files) from what they gave you — see File layout below. Show it back
once and ask them to approve or give one correction. Don't iterate
section by section during drafting; the interview already did that.

## Test before publishing

Before attaching the new skill to any real agent, run it: replay the
worked example as if a client had just sent that opening message, using
the draft skill's own Intake/Process/Output. Show the creator the
persona's response and ask: **"Would you have said that? What's the one
thing you'd change?"**

- If they approve: publish it. For a persona's FIRST verb, attach the
  whole persona skill to their agent with \`manage_agent\`'s \`patch\`,
  \`field:"skills", op:"add", value:"<skillId>"\` (get the id from
  \`manage_skill\` \`action:"read"\`). For an ADDITIONAL verb on a persona
  already attached, there's nothing new to attach — it's the same
  skillId, just grown.
- If they give one correction: revise the relevant section(s) and test
  again. Don't publish on a "close enough" — one more pass is cheap here
  and expensive after a real client sees it.

This mirrors how the creator will keep improving it later, too: real
conversations surface a "here's what I'd have said differently," which
becomes a short revision — not a rewrite from scratch.

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

\`\`\`
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
