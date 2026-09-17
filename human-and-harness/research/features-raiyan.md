# Feature Breakdown — Raiyan (Creator)

One level down from the user story: not "Raiyan builds a firm," but the exact
features that step needs. Still high level — no implementation detail — just
what has to exist as a product surface for each part of his journey.

*Story: [`user-stories.md`](./user-stories.md#raiyan--the-creator) ·
Other breakdowns: [Sabik](./features-sabik.md) · [Naman](./features-naman.md)*

---

## 1. Sign up & account

- Email / OAuth sign-up
- Creator profile basics: name, photo, one-line bio
- Claim a personal link (`humansandharness.ai/raiyan`)

## 2. Agent Architect — conversational firm builder

- Open-ended chat intake: "describe your expertise" instead of a form
- Follow-up questions the tool asks to narrow scope (who you serve, what you
  don't do, how you'd triage a new problem)
- Draft generator that outputs, from that conversation:
  - Firm name & one-line positioning
  - Lead AI consultant persona (tone, the discovery questions it opens with)
  - A proposed subagent roster (name + specialty + short description each)
- Edit-in-place on every generated field (rename a subagent, rewrite
  positioning, regenerate just one part without restarting)
- Explicit "approve & save" step — nothing goes live from a draft alone

## 3. Firm configuration

- **Lead consultant editor** — tone/voice, discovery-question style, escalation
  rules (when it should hand off to Raiyan instead of guessing)
- **Subagent manager** — add / remove / edit subagents; each has a name,
  specialty, and the kinds of tasks it's allowed to take
- **Engagement types** — define what Raiyan sells as Task / Project / Case,
  with a description and expected scope for each
- **Pricing** — set a price (or price range) per engagement type

## 4. Skills, knowledge & tools

- Upload reference material the firm should draw on (his cost-model
  templates, forecasting methodology, past engagement examples)
- Connect integrations the subagents can use (spreadsheets, calendar, other
  data sources / MCPs)
- Set fallback availability (when Raiyan himself is reachable for
  human-in-the-loop cases)

## 5. Publish

- Public storefront page preview before going live
- Marketplace listing: category, searchable keywords, short pitch
- Toggle: personal-link-only vs. also-listed-in-marketplace
- Go live / unpublish control

## 6. Operate — the creator dashboard

- **Engagement inbox** — list of active, pending-review, and closed
  engagements
- **Engagement detail view** — the scope of work, what the AI has done so
  far, and current status
- **Fallback alerts** — a clear signal when an engagement needs Raiyan
  directly (like Naman's case), with the AI's partial work already attached
  so he doesn't start from zero
- **Visibility into demand** — what problems clients are actually bringing
  the firm, so Raiyan knows which subagents/skills to improve
- **Firm editing over time** — same builder from step 2/3, reopened to
  refine an existing firm rather than create a new one
- **Payments & payouts** — earnings per engagement, payout history

---

## See also

- [`features-sabik.md`](./features-sabik.md) — the client-side feature set
  for a fully AI-closed engagement (discovery, scope approval, deliverable
  review, payment)
- [`features-naman.md`](./features-naman.md) — the additional features the
  fallback path needs on the client side (what he sees when it escalates to
  Raiyan, how that's communicated)
