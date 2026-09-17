# Founder Notes — Bootstrap Model, AI+Human Fallback, Conversational Creation

Notes from a conversation where the founder described how they actually want
Humans & Harness to work, beyond what's in [`product-engineering-analysis.md`](./product-engineering-analysis.md).
This file captures (1) what was understood, and (2) open questions to resolve
before updating the main analysis doc — those questions were carried forward
into [`open-questions-punchlist.md`](./open-questions-punchlist.md).

---

## What's new vs. the original analysis doc

### 1. Bootstrap phase — Admin is the first Creator

The original doc said "V1 launch has no users yet." The actual plan is more
specific: **the founder (admin) will personally act as the first Creator.**

raiyan : ha yahi hoga as initial o yahi sab karte hai l

They will use their own expertise to build consultancies for specific
problems and publish them — so the platform has real, working services on it
*before* any outside creator joins. Admin and Creator are the same person in
this bootstrap phase. no they are differnet okay admin have admin but they cna create liek cratore also at ttaht si system

### 2. AI-first execution, with a Human fallback — the biggest new idea

The flow is:

```
Problem discussion → Scope of Work → Planning → AI execution starts
 → if AI completes the work        → deliverable is the AI's output
 → if AI CANNOT complete the work  → a real human (the founder, initially)
                                       does the work manually instead
```
-> and i also want that a mea as a consuealt ser by ai oay i wan tto see who is sinterneact to my ai adns o on what problem they are faing and so on as req

Meaning: every consultancy has a **guaranteed human fallback** behind it —
at first, that human is the founder themselves — so a user never just gets
"sorry, the AI got stuck." They always get a deliverable, whether the AI
produced it or a human stepped in. nohums is not founder human is who create the its there own consult firm in tpour website okay

This was **missing** from the original doc. §3 (Execution) and §6 (lifecycle)
only had a "revision loop" (AI redoes work if the user asks for changes) —
not a human-takes-over-when-AI-fails path. This needs to become an explicit
new state in the Engagement/Deliverable model.

### 3. Consultancy creation is conversational, not form-based

Agent Architect isn't just fields/forms — a creator **builds their
consultancy by talking to an AI agent**, dumping their real expertise into
the conversation (not just a short "services list + positioning," which is
what the original doc's MVP assumed).

Example given: someone wants to deploy a small app, doesn't know how,
searches the internet and can't find a good answer — but finds a creator's
consultancy that has real depth: a script/walkthrough, a theme/approach,
a full list of problems that can come up, and how to tackle each one. That
richness is what the creator hands over conversationally when building the
consultancy, and the agent turns it into the consultancy's operating
knowledge.

### 4. MCP + RCP as the underlying protocol layer

The founder said this whole thing (agent-based consultancy creation, tool
connections) is designed around MCP and RCP. (Context: RCP is the founder's
own standalone open protocol — client/server roles, auth tiers, resolvers —
separate project at `D:\projects\rcp`.)

Not yet clear exactly how RCP plugs in here — see open questions below. yes rcp is open protc that conet ai wiht eh rest okay we are gogint o suer the persona sdk that alrey using mcp rcp asnd eveyrhting that we req 

---

## Open questions to resolve before updating the main doc

1. **Human fallback at scale** — Right now the founder is the fallback for
   everything. Once outside creators join, is each creator responsible for
   being their own consultancy's human fallback (since it's their expertise),
   or is there a platform-level fallback team/pool? yes human fallbacine me i as  people okay i can not give serviec to all okay so i creat ai agent ficsuutla so what if ai cannnto solce then htere shoudl eb aswya tto concne iwht eh creator eof that firm to solve that issue amy wbe we cahrge for that that later phase discussesion

2. **Who/what decides "AI couldn't do it"?** — Does the AI self-report being
   stuck (e.g. it says "I can't complete this"), or is there another
   trigger — a timeout, the user marking themselves unsatisfied, an eval/QA
   check failing — that hands the engagement off to a human? ws=e need to work on this 

3. **RCP's exact role** — Is the "creator talks to an agent to build a
   consultancy" flow itself built on top of RCP (i.e. consultancy creation
   is an RCP-based interaction)? Or is RCP scoped narrower — just for
   connecting tools/MCPs/data sources once a consultancy already exists? rcp is lik mcp that user eest api to conncet to teh ai agent 

---

## Next step

Once these three questions are answered, update
[`product-engineering-analysis.md`](./product-engineering-analysis.md) with new sections:
- **Bootstrap Phase** (admin-as-first-creator)
- **AI + Human Fallback Model** (new Engagement/Deliverable state)
- **Conversational Consultancy Creation** (replaces the form-based MVP
  assumption in §3 and §10)
