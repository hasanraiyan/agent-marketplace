# Consultancy Research

## Core idea

A consultancy rents out an outside "expert brain" to a company — for a specific
problem, on a temporary basis, without permanently hiring that expert.

A company hires a consultant for one of three reasons:

- **Expertise gap** — they don't have that specific knowledge in-house
  (e.g. AI strategy, cost restructuring)
- **Capacity gap** — they have the knowledge, but the team is busy/understaffed
- **Objectivity/politics** — sometimes a company needs a neutral outside opinion
  free of internal politics (e.g. "who should be laid off" — the CEO doesn't
  want to say it, so the consultant does)

## Types of consultancy

| Type | Examples | What they do |
|---|---|---|
| **Strategy consulting** (top tier, "MBB") | McKinsey, BCG, Bain | High-level business decisions — "which market to enter," "how to grow" |
| **Big 4 / Professional services** | Deloitte, PwC, EY, KPMG | Audit + tax + strategy + implementation — very broad range |
| **IT/Tech consulting** | Accenture, Infosys, TCS | Technology implementation — software, digital transformation |
| **Boutique/specialized** | Small firms focused on one niche | e.g. purely "HR consulting" or purely "fintech compliance" |

H&H's model is closest to **boutique/specialized** — each consultancy focuses
on a narrow expertise (e.g. "fitness coaching for busy professionals"), not a
broad strategy firm like MBB.

## Billing models (how they make money)

1. **Hourly/day rate** — billed by hours/days worked (junior consultants
   cheap, partners expensive)
2. **Fixed project fee** — a flat price set for the whole engagement
   (per the SoW)
3. **Retainer** — a fixed monthly fee for ongoing access
4. **Value-based / success fee** — payment tied to results (rare,
   high-risk high-reward)

Open question: which of these (or mix) H&H should use — see §13 of the
analysis doc.

## Team structure — the "staffing pyramid"

```
Partner/Principal  (1)   → client relationship, final ownership
   ↓
Manager            (2-3) → day-to-day lead of the engagement
   ↓
Consultant/Associate (5-8) → actual analysis/execution
   ↓
Analyst             (10+)  → data, research, grunt work
```

More people at the bottom = better profit margin (seniors are expensive but
bill fewer hours; juniors are cheap but bill more hours — the "leverage
model").

**Mapping onto H&H:**

- Partner/Manager → **Lead AI Consultant**
- Consultant/Analyst → **Subagents**

Difference: H&H doesn't need the hierarchy — Lead + flat subagents is enough
(already flagged in the analysis doc §5 — "skip the org hierarchy, it exists
mostly for human incentive/politics reasons").

## How an engagement runs (real firm)

```
1. Win the pitch/RFP        → H&H equivalent: marketplace discovery
2. Intake/discovery call    → understand the problem
3. Scope of Work (SoW)      → written agreement — what gets delivered, what doesn't
4. Staffing                 → which specialists get assigned
5. Execution                → the actual work
6. Deliverable + review     → hand off to client
7. Close-out                → billing, wrap-up doc
```

This matches the structure already mapped in the analysis document
(Conversation → SoW → Engagement → Execution → Deliverable → Complete) —
meaning the H&H design already follows the real-world pattern; this doc
validates it against how actual consultancies operate.

## Open angles to research further

- What an actual McKinsey/BCG SoW looks like (structure, clauses, scope
  boundaries) — could inform H&H's SoW template
- Real-world billing/monetization options in more depth, to resolve §13
