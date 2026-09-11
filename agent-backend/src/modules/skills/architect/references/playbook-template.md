# Playbook template

Copy this structure exactly. Replace every angle-bracket with the creator's content. Delete a section only if the creator genuinely has nothing there, and say so in one line.

## SKILL.md

```markdown
---
name: <verb-object>
description: <What this does for the client and when to use it, in the client's words. One or two sentences. This line triggers the skill.>
title: <Display name, e.g. Coach a PM career transition>
hook: <One line in the client's words: what this lets the persona do for them>
category: <entrepreneurship | health-fitness | mind-behavior | technology | life-relationships | careers | other>
---

# <Title in plain words, e.g. "Coach a career transition">

## 1. Intake — who is this, and what did they come for
Ask before doing anything else, one or two at a time. Skip what the conversation already answers.
- <Question 1> — changes: <what differs depending on the answer>
- <Question 2> — changes: <...>
- <Question 3, optional>
Distinctions that matter: <e.g. "under 2 years experience vs 5+", "deadline inside 30 days vs open">

## 2. My rules for this (and why)
- <Rule> — because <reason in the creator's words>
- <Rule> — because <reason>
- <Rule> — because <reason>

## 3. Process
### Phase 1 — <name>
Goal: <what this phase achieves>
I ask: <what I need from them>
I produce: <what they get>
Done when: <observable condition>
### Phase 2 — <name>
...

## 4. Topics (load the one that matches; read this index every time)
| Topic | Load when | File |
|---|---|---|
| <topic> | <the situation that calls for it> | references/<topic>.md |
| ... | ... | ... |

## 5. What the client walks away with
<Exact format: headings, table, list, length. If it's long, it's a file in /workspace/outputs/ presented with present_file.>

## 6. Boundaries and hand-offs
- When <trigger>: I stop and say "<exact sentence>" and point to <who>.
- I never <thing>, because <reason>.

## 7. Worked example
<One real case in 6–10 lines: who they were, what they opened with, the intake answers, what I did phase by phase, what they walked away with, what happened after.>
```

## references/<topic>.md (mini-template, one per topic)

```markdown
# <Topic>

When this applies: <the situation, in one line>

## How I go about it
1. <step> — <what I'm looking for / why>
2. <step>
3. <step>

## What I always say / ask here
- <the creator's phrasing>

## Common mistakes I correct
- <mistake> → <what I say instead>

## Output for this topic
<format, if different from the skill's default>

## Example
<3–5 lines: a real case for this topic>
```

## Limits
SKILL.md under 300 lines. Each topic file under 150 lines. Up to 8 topics per skill; more means split the skill.
