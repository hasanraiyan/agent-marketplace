# Humans & Harness — User Stories

Three people, walking through the product end to end: one creator building a
consultancy, and two clients hiring it — one where the AI closes the job on
its own, one where it can't and the human fallback kicks in.

For the concept behind the platform, see [`consultancy.md`](./consultancy.md).
Each person below has a one-level-down feature breakdown:
[Raiyan](./features-raiyan.md) · [Sabik](./features-sabik.md) · [Naman](./features-naman.md)

---

## Raiyan — the Creator

*Feature-level breakdown: [`features-raiyan.md`](./features-raiyan.md)*

Raiyan spent eight years doing operations consulting for mid-size logistics
companies — inventory forecasting, warehouse layout, supply chain cost
cutting. He's good at it, but he can only run 3-4 client engagements at a
time before his calendar breaks.

**1. Sign up.** Raiyan creates an account on Humans & Harness and gets a
single public link: `humansandharness.ai/raiyan`.

**2. Build the firm, conversationally.** Instead of filling out a form,
Raiyan just talks to Agent Architect: "I do supply chain and ops consulting
for logistics companies — mostly inventory forecasting and warehouse cost
reduction." Agent Architect drafts:

- A firm name and positioning: **"Raiyan Ops Advisory."**
- A lead AI consultant that knows how to run an ops discovery conversation
  the way Raiyan would.
- Subagents for the sub-skills Raiyan actually uses: a forecasting agent, a
  warehouse-layout agent, a cost-modeling agent.

Raiyan reviews the draft, tweaks the tone, corrects a couple of assumptions
about his process, and approves it.

**3. Attach what his practice already runs on.** Raiyan connects the
spreadsheet templates he uses for cost models, his standard forecasting
methodology doc, and a calendar so the AI consultant knows when he's
reachable for a fallback.

**4. Publish.** Raiyan Ops Advisory goes live — on his own link, and
discoverable in the Humans & Harness marketplace under "Operations &
Supply Chain."

**5. Operate.** From here Raiyan doesn't run every engagement — he watches
them. He sees what problems clients are bringing him, steps in when the AI
flags that it's stuck, and refines the firm's subagents and skills based on
real cases instead of guessing.

---

## Sabik — the Client whose engagement the AI closes end to end

*Feature-level breakdown: [`features-sabik.md`](./features-sabik.md)*

Sabik runs a small e-commerce brand and just opened a second warehouse.
His shipping costs jumped and he doesn't know why.

**1. Discover.** Sabik finds Raiyan Ops Advisory through the Humans & Harness
marketplace, searching "warehouse cost reduction."

**2. Describe the problem.** He opens a conversation with the AI consultant
and explains the situation the way he'd explain it to a person: two
warehouses, costs up 30%, no idea which one is the problem.

**3. Scope of work.** The AI consultant comes back with an explicit scope
before touching anything: *Deliverable — a cost breakdown by warehouse plus
a prioritized list of fixes. Includes — shipping, storage, and labor cost
analysis. Excludes — contract renegotiation with carriers.* Sabik approves it.

**4. Execution.** The lead consultant routes the work: the cost-modeling
subagent pulls apart Sabik's shipping invoices, the warehouse-layout
subagent flags an inefficient pick path at the new location.

**5. Deliverable.** Sabik gets back a real report — the cost breakdown, the
three biggest drivers, and ranked recommendations — not a chat transcript.
He asks for one revision (a clearer breakdown by SKU category), gets it, and
approves.

**6. Payment.** Sabik pays for the engagement through his own scoped price,
the same way he'd pay for a booked session on a creator platform today.

Raiyan never had to personally touch this one. That's the whole point.

---

## Naman — the Client whose engagement needs the human fallback

*Feature-level breakdown: [`features-naman.md`](./features-naman.md)*

Naman is scaling a subscription box business and wants to open a third
fulfillment center in a new region — a much bigger, messier decision than a
cost cleanup.

**1. Discover & describe.** Same entry point as Sabik: Naman finds Raiyan
Ops Advisory and explains what he needs — help deciding *where* to open the
new center and how to structure it.

**2. Scope of work.** The AI consultant proposes a scope, Naman approves it.

**3. Execution — where it gets stuck.** The subagents pull regional cost and
logistics data fine, but the decision also hinges on things that aren't in
any dataset: Naman's supplier relationships in one region, and a labor
contract nuance the AI has no visibility into. The lead consultant recognizes
it can't respons­ibly finish the recommendation on its own.

**4. Human fallback.** Instead of guessing or stalling, the engagement
escalates to Raiyan directly. Raiyan already has the AI's partial analysis
and the full scope of work waiting for him — he doesn't start from zero. He
has one working session with Naman, folds in the context only he has, and
finishes the recommendation himself.

**5. Deliverable & payment.** Naman still gets one clean deliverable — a
site recommendation with reasoning — and pays the same way Sabik did. From
Naman's side, the engagement never "failed"; it just had a human in the loop
for the part that needed one.

---

## What this demonstrates

- **Raiyan** — how a creator turns existing expertise into a firm without
  writing anything technical, and why he can run far more engagements than
  his calendar alone would allow.
- **Sabik** — the default path: AI consultant + subagents close the job
  completely, scoped and reviewed, no human time spent.
- **Naman** — the guarantee in action: when the AI hits the edge of what it
  can responsibly decide, the creator is pulled in with full context, and
  the client still gets one deliverable, not a dead end.
