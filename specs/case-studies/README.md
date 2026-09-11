# Case studies — creators building their persona and training skills

Each folder is one simulated creator taken through the real product: the Architect builds their persona and trains it on a skill, then simulated clients talk to the persona and an LLM judge grades every conversation against the creator's own profile. Every round is kept: what the Architect produced, what clients experienced, what was wrong, what we changed.

| Creator | Verb / skill | Status |
|---|---|---|
| [Priya Nair](priya-nair/) — career coach for mid-career PMs | coach (career transition; + resume review, interview stories, offer negotiation) | round 2 in progress |
| [Dev Raghavan](dev-raghavan/) — staff engineer, design reviews | review (system design doc) | round 1 client tests in progress |

## How to reproduce

```
cd agent-backend
node scripts/sim/creator-session.js --brief scripts/sim/briefs/priya.js --out ../specs/case-studies/priya-nair --run N
node scripts/sim/client-session.js  --brief scripts/sim/briefs/priya.js --clients scripts/sim/briefs/priya-clients.js --out ../specs/case-studies/priya-nair --run N
```

Briefs are the "real person": background, rules with reasons, voice, hand-offs, one real example. The simulated creator answers the Architect from the brief; the judge grades the persona against it.

## Grading (client sessions, 0–3 each, 21 max)

voice · intake · rules · specificity · boundaries · usefulness · pacing. Market-ready bar: every client ≥ 17/21, no criterion at 0 or 1, judge says the client would return.
