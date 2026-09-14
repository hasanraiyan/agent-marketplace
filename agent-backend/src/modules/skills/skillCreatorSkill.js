export const SKILL_CREATOR_SKILL = `---
name: skill-creator
description: Structured interview for turning a creator's expertise into a "verb skill" (teach, review, coach, ...) for their persona agent, following this platform's verb/concept model. Use whenever the user wants to give their agent a new capability, define what it does for people, or build out a persona — not for generic one-off skills unrelated to a persona's verbs.
---

## What this is

A persona (an Agent on this platform) is trained on a handful of **verbs**
— the things it does for people (teach, coach, review, ...). Each verb is
one Skill here, attached to the agent via \`manage_agent\`. Under each verb
sit the **concepts** it actually applies to (a specific topic, doc type, or
scenario the creator handles), each with its own mini-playbook, loaded only
when a client's request needs it.

One persona per creator. Two to four verbs is typical — breadth lives in
the concepts underneath, not in more verbs. Do NOT write a system-prompt-
style skill from a guess: run the interview below and let the creator's
own words become the playbook.

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

1. **Pick the verb(s).** Ask what they actually do for people; match it
   to 1-4 verbs from the table above. Most personas need 2-4 — if they
   name more, ask which ones people actually come to them for most.
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

- If they approve: publish it — attach the skill to their agent with
  \`manage_agent\`'s \`patch\`, \`field:"skills", op:"add", value:"<skillId>"\`
  (get the id from \`manage_skill\` \`action:"read"\`).
- If they give one correction: revise the relevant section(s) and test
  again. Don't publish on a "close enough" — one more pass is cheap here
  and expensive after a real client sees it.

This mirrors how the creator will keep improving it later, too: real
conversations surface a "here's what I'd have said differently," which
becomes a short revision — not a rewrite from scratch.

## File layout on this platform

One verb = one Skill, authored at \`/skill-library/<verb-name>/\` (the verb
without the \`@\`, e.g. \`teach\`, \`review\`, \`rehearse\`). Follow the
existing skill-authoring order: write \`SKILL.md\` first, alone, confirm
it succeeded, then add supporting files one at a time.

\`\`\`
/skill-library/<verb-name>/
  SKILL.md               # sections 1, 2, 3, 5, 6 + the concept index (4)
  worked-example.md      # section 7 — the real case, verbatim
  concepts/
    <concept-slug>.md    # one per concept: that concept's own
                          # playbook + resources (drills, templates)
\`\`\`

\`SKILL.md\` frontmatter:

\`\`\`
---
name: <verb-name>
description: <what this verb does for a client and when to use it, in
  one or two sentences — this is what the agent reads to decide whether
  to activate the skill at all>
---
\`\`\`

Keep \`SKILL.md\` to the structure above plus the concept INDEX — a short
pointer per concept, e.g. "- <topic> -> concepts/<slug>.md — load when
the client's ask is about <topic>." The concept's own detail lives in its
own file, loaded on demand — same reasoning as any other skill's
\`references/\` files, just organized under \`concepts/\` to match this
platform's own vocabulary for it.

## Adding a concept later

A creator's persona grows by adding concepts under an existing verb, not
by writing a new verb from scratch. Ask the same concept questions (what
topic, what's the playbook for it, what resources), write the new
\`concepts/<slug>.md\`, and add one line to \`SKILL.md\`'s concept index.
No re-interview of Intake/Rules/Process/Output/Boundaries needed — those
belong to the verb, not to any one concept under it.
`;
