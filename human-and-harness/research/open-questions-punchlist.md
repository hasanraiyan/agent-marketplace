# Open Questions Punch List

Based on your answers in [`founder-notes-fallback-and-bootstrap.md`](./founder-notes-fallback-and-bootstrap.md). Some things got
resolved, some got clarified but opened new sub-questions, and one is still
fully open. This file is just the punch list — no analysis, just what needs
a decision.

---

## Still fully open

### 1. What exactly triggers "AI couldn't do it" → hand off to human creator?
You flagged this as unresolved ("we need to work on this"). Options to pick
from or combine:
- AI self-reports ("I can't complete this")
- A timeout (AI stuck/looping past N turns or N minutes)
- User marks themselves unsatisfied / explicitly asks for a human
- An eval/QA check fails on the AI's output before it's shown to the user

This decision drives the Engagement state machine, so it blocks updating the
main analysis doc's Execution section.

---

## Clarified, but raised new sub-questions

### 2. Admin vs. Creator roles
You corrected: Admin and Creator are **different roles**, but Admin also has
the ability to act as a Creator within the same system (not "admin = creator,
same person, no distinction").
- What can Admin do that a Creator cannot? (e.g. moderation, platform
  settings, seeing all firms — vs. a Creator only manages their own firm)
- When Admin acts "as a creator," do they use the exact same creator flow as
  everyone else, or is there an admin-only shortcut?

### 3. Creator-facing analytics / visibility into their own AI
New requirement from you: a creator should be able to see **who is
interacting with their AI and what problems those users are facing.**
- What's in scope: raw conversation transcripts, or aggregated
  problem-type analytics, or both?
- Privacy: does the end user need to consent to their conversation being
  visible to the creator?
- Is this a V1 requirement or does it come after the core loop (task/SoW/
  deliverable) is working?

### 4. Human fallback = the creator of that firm, not the founder
Confirmed: each creator is the fallback for their **own** firm (not you,
once other creators exist). New question:
- How does "connect with the creator to solve the issue" actually work
  mechanically? Does the creator get pulled into the same conversation, get
  a notification/ticket, or does the engagement get reassigned to them
  entirely?
- You mentioned possibly **charging for this escalation** — explicitly
  deferred to a later phase, but worth a one-line placeholder in the
  roadmap so it's not forgotten.

### 5. RCP + Persona SDK integration
Confirmed: RCP is an open protocol (like MCP) that lets a user/API connect
to the AI agent, and the plan is to use the **existing Persona SDK**, which
already wires up MCP + RCP.
- Worth verifying: does the current Persona SDK actually have working RCP
  support today, or is that still planned? (Cross-check against
  `D:\projects\rcp` and the SDK repo before assuming it's ready to build on.)

---

## Suggested order to resolve these

1. Q1 (AI-fails trigger) — blocks the Engagement/Deliverable state model. swait this si not the fallbacken this si featuyre okay
2. Q4 (fallback mechanics) — depends on Q1's answer (what state are we
   handing off from?).
3. Q2 (Admin vs Creator permissions) — needed before building any
   role-gated UI. 
4. Q3 (creator analytics) — can be scoped as P1, doesn't block the core
   loop.
5. Q5 (RCP/SDK verification) — a quick check, not a decision, do this
   whenever convenient.
