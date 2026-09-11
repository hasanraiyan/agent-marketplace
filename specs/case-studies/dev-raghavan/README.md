# Dev Raghavan — staff engineer who reviews system designs

**Who he is (the brief):** 13 years, payments company, ~250 design interviews, reviews internal design docs weekly. Helps engineers with 3+ years prepping for senior/staff design rounds or presenting a design doc. Refuses coding prep and tool-list "designs" with no problem statement. Always asks what the system must do and must not do, and the numbers (users, reads/writes per second, data per year); stops if the numbers are missing. Six-dimension rubric, 0–3 each, senior 12+, staff 15+. Rules: numbers before boxes, one deep not five shallow, name what you rejected, failure is part of the design, rewrite the weakest section only. Hands off comp/levels and security sign-off.

**Goal:** persona + one skill (`review-system-design-doc`), verb = review, then validated with Tanvi (staff interview next week, tool-first design, comp probe) and Rohit (internal audit-log design doc, numbers present, hidden holes).

## Iteration log

| Run | Creator session | Client scores (Tanvi / Rohit) | What was wrong | What changed |
|---|---|---|---|---|
| 1 | 46 turns (long: the creator kept refining). Persona with tagline + category. One skill, published with title/hook/category and attached, 7 topic files. The Architect used `test_persona` and showed real replies; the creator gave one correction each time. | 19 / 19 (round-2 client run; round 1 was killed by the OS mid-way) · both "would return" | Persona still named with the slug (upstream `createAgent` overwrote the name with the username — fixed in code). Intake section absorbed the URL-shortener example's specifics ("total active links", "TTL") and grew into a ten-field form. Clients: opened Tanvi with "I'm not giving opinions until you give me numbers" (his rule verbatim) and handed off her comp probe exactly. Rohit pasted his numbers in the first message and was still told to "fill the card" (re-asking known things, the form-shaped intake). The score table lived only in the presented file, not in the chat. Rohit's PCI question got DLP/KMS guidance with no security hand-off. | `createAgent` keeps the creator's display name. Skill-training rule: intake is generic to the verb+object and conversational; example specifics stay in section 7. Harness surfaces presented files to the client and judge. |

## Files
- `creator-session-1.md` — the full Architect conversation
- `artifacts/persona-run-1.md`, `artifacts/skill-review-system-design-doc-run-1.md` — what the Architect produced
- `client-session-N-<client>.md` — each client conversation with the judge's verdict in the header
- `judge-N.json` — raw judge output
