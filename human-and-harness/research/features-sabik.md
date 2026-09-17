# Feature Breakdown — Sabik (Client, AI closes the engagement)

Same level of detail as the Raiyan breakdown: the exact product surface
Sabik touches, stage by stage, still high level.

*Story: [`user-stories.md`](./user-stories.md#sabik--the-client-whose-engagement-the-ai-closes-end-to-end) ·
Other breakdowns: [Raiyan](./features-raiyan.md) · [Naman](./features-naman.md)*

---

## 1. Discover

- Marketplace search / browse, filterable by problem category (e.g.
  "warehouse cost reduction," not just firm name)
- Firm profile page: positioning, what it does/doesn't handle, example
  engagement types, pricing
- Direct-link entry too — arriving straight at `humansandharness.ai/raiyan`
  skips search entirely

## 2. Describe the problem

- Open conversation with the lead AI consultant (chat interface, not a form)
- The consultant asks clarifying/discovery questions rather than expecting
  a perfectly-specified request up front
- Ability to attach supporting material (e.g. shipping invoices) directly in
  the conversation

## 3. Scope of work

- Structured scope card generated from the conversation: deliverable,
  what's included, what's excluded, estimated price
- Explicit approve / request-changes action before any execution starts
- Scope stays visible/referenceable for the rest of the engagement

## 4. Execution — visibility while it runs

- Live status indicator (e.g. "scope approved" → "subagents executing" →
  "deliverable ready for review") so Sabik isn't just staring at silence
- Ability to send a clarifying message mid-execution if the consultant asks
  a follow-up question

## 5. Deliverable & review

- Deliverable presented as a real artifact (report/plan/document), not a
  chat transcript
- Review action: approve, or request a specific revision
- Revision loop stays scoped to the original scope of work (no re-negotiating
  from scratch)

## 6. Payment

- Pay-per-engagement checkout at the price set in the approved scope
- Receipt / record of the engagement tied to the deliverable
- (Later) re-engage the same firm for a follow-up without redoing discovery
  from zero

---

## See also

- [`features-naman.md`](./features-naman.md) — everything above, plus what's
  different when the engagement escalates: the fallback notice, what he sees
  change, and how the human hand-off is communicated without feeling like a
  failure
