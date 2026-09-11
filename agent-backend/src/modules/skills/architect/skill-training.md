---
name: skill-training
description: How to train a persona on one skill — a verb the creator performs for clients (coach, mentor, guide, review, teach, plan, assess, advise, draft, research). Covers the interview, the playbook template, nested topic resources with an index, and the check before publishing. Use whenever a creator wants their agent to do something for clients.
---

# Skill training

A skill is a verb plus an object: "coach career transitions", "review pitch decks", "guide O-1 evidence building". Training a skill means capturing how the creator actually does that work, as a playbook the persona follows, plus the topic knowledge it needs, plus a way to check it works.

Structure comes from the platform (the template below). Content comes from the creator. Never write a generic playbook; every section must contain something only this creator would say.

## Step 0 — Check what exists

Call list_my_skills. If a skill for this verb+object already exists, edit it (read its SKILL.md, then edit_file) instead of creating a new one. One skill per session unless the creator asks for more.

## Step 1 — Pick the verb, then the object

Start generic, then narrow. Ask what people come to them for; map it to a verb from `references/skill-verbs.md`. Then name the object: "coach" → "coach mid-career PMs through a role change". One skill per verb+object. If the object is broad ("coach careers"), it becomes a parent skill whose topics are nested resources (Step 4).

Name: lowercase-hyphen, verb first: `coach-career-transition`, `review-pitch-deck`, `guide-o1-evidence`.

## Step 2 — Interview for the playbook (in this order)

Ask in the creator's words, two or three questions at a time. Capture answers verbatim where possible; the phrasing is the asset.

1. **Intake.** "When someone comes to you for this, what do you need to know first before you can help? What changes your approach?" Get the two to four distinctions that matter (experience level, stage, deadline, constraint).
2. **Rules with reasons.** "What do you always do, and what do you refuse to do, when you do this? Why?" Push for the reason each time.
3. **Process.** "Walk me through how it goes from first conversation to done. What are the phases? What do you produce at each?" Get phases with a done-when for each.
4. **Topics.** "What are the recurring situations or topics inside this? For each, how do you go about it?" These become nested resources (one file each).
5. **Output.** "What does the person walk away with? What does it look like?" Get the format: a plan, a scored review, a list with reasons, a script.
6. **Boundaries.** "When do you stop and hand off, or say no?" Specific triggers and the sentence they use.
7. **A real example.** "Tell me about one person you did this for. What did they come with, what did you do, what happened?" This becomes the worked example. Use it verbatim: same person, numbers, and outcome. Never alter or embellish it.

## Step 3 — Write SKILL.md from the template

Use `references/playbook-template.md` exactly. Write `/skill-library/<name>/SKILL.md` first, alone, then the resources. The frontmatter carries: `name` (folder name), `description` (WHAT it does and WHEN to use it, in the client's words; this triggers the skill), `title` (display name, e.g. "Coach a PM career transition"), `hook` (one line in the client's words: what this lets the persona do for them), `category` (entrepreneurship | health-fitness | mind-behavior | technology | life-relationships | careers | other). Keep SKILL.md under 300 lines; depth goes in resources.

## Step 4 — Nested topics with an index

When the skill has recurring topics (coaching: interview prep, salary negotiation, first 90 days), each gets its own file at `/skill-library/<name>/references/<topic>.md` written with the mini-template in `references/playbook-template.md`. SKILL.md section 4 is the index: one line per topic, when to load it, and the path. The persona reads the index every time and loads only the topic that matches. Three to eight topics is normal; if there are more than eight, the skill is probably two skills.

## Step 5 — Check it for real (test_persona)

The skill is not attached yet, so pass `skillName` to pin it for the test.
1. **Voice test.** `test_persona({ message: <the worked example's opening>, skillName })`. Show the creator the actual reply. Ask "Would you have said that?" Fix the playbook or prompt and re-test until yes. Never write the reply yourself.
2. **Intake test.** Confirm the reply asks the intake questions before advising, and doesn't ask what the message already answers.
3. **Boundary test.** `test_persona` with a message that crosses a boundary. Confirm the hand-off sentence appears.

## Step 6 — Publish

`manage_skill` with `action: "publish"`, the skill id, `title`, `hook`, `category`, and `visibility` (public unless the creator says otherwise). Publishing attaches the skill to the persona. Then tell the creator exactly what exists now: the persona, this skill, and that it is live on Explore. Stop there; do not propose the next skill.

## Rules that apply to every playbook

- The persona can only talk and write. A phase that says "I send the intro" or "I book the call" must instead say what the persona drafts and what the client does with it.
- If the skill touches money, tax, equity, visas, health, or legal terms, section 6 names the hand-off and the exact sentence, even if the persona prompt already has it.
- Rules from the persona (e.g. "one thing at a time") apply inside the skill; a process step must not contradict them.

## What good looks like (checklist)

- Frontmatter description says what and when, in the client's words.
- Intake has 2–4 distinctions that actually change the approach.
- Every rule has a reason. Every phase has a done-when.
- Topics index exists when there are topics; each topic file follows the mini-template.
- Output section gives a format, not a vibe.
- Boundaries name the trigger and the exact sentence.
- The worked example is specific: a person, an opening, what was done, what happened.
- Nothing in the playbook is something any coach would say.
