# Feature Breakdown — Naman (Client, human-fallback path)

Same level of detail as the Raiyan and Sabik breakdowns. Naman's journey
shares steps 1-3 with Sabik's (discover, describe the problem, approve a
scope of work) — those features aren't repeated here. This is what's
*additional* for the path where the AI can't finish on its own.

*Story: [`user-stories.md`](./user-stories.md#naman--the-client-whose-engagement-needs-the-human-fallback) ·
Other breakdowns: [Raiyan](./features-raiyan.md) · [Sabik](./features-sabik.md)*

---

## 1-3. Shared with Sabik

- Marketplace/direct-link discovery
- Conversational problem intake with the lead AI consultant
- Structured scope-of-work card with approve / request-changes

*(see [`features-sabik.md`](./features-sabik.md) for these)*

## 4. Execution — the stall

- Same live status indicator as Sabik's path, but with an additional state:
  "needs human review" instead of just moving straight to "deliverable
  ready"
- Consultant-side capability to recognize and flag its own limits (missing
  context it can't get from data — e.g. supplier relationships, contract
  nuance) rather than guessing or silently stalling
- Partial-work handoff package: whatever the subagents already produced is
  preserved and attached, not discarded

## 5. Fallback notice — what Naman actually sees

- Clear, non-alarming notification: the engagement is being finished by
  Raiyan directly, not "the AI failed"
- Visibility into *why* — a short explanation of what needs human judgment,
  so it doesn't feel opaque
- Expected-response-time indicator for the human step (so it doesn't feel
  like the engagement vanished)

## 6. Human session

- Scheduling/connection surface to get Naman and Raiyan into a working
  session (the fallback still needs a real touchpoint, not just an async
  message)
- Raiyan enters that session with the full scope of work and the AI's
  partial analysis already loaded — Naman shouldn't have to re-explain
  anything from scratch

## 7. Deliverable & payment

- Same deliverable format as Sabik's — one finished artifact, review/approve
  action, same payment flow
- No separate "fallback surcharge" or different pricing flow — the
  engagement is priced once, at scope-approval time, regardless of which
  path finishes it

---

## What this set of three breakdowns now covers

- [`features-raiyan.md`](./features-raiyan.md) — the creator's full
  build/operate feature set
- [`features-sabik.md`](./features-sabik.md) — the client path when AI
  closes the job alone
- `features-naman.md` (this file) — the delta for when the human-fallback
  guarantee kicks in

Together these three files are the complete one-level-down feature map for
the walkthrough in [`user-stories.md`](./user-stories.md).
