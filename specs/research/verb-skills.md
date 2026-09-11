# Research: verb skills — what a creator trains their agent on

**The concept under test.** A creator's expertise is trained into their persona as a small set of generic *verb skills* (@teach, @coach, @review, @advise…). Each verb skill is a playbook the platform structures and the creator fills. Under each verb sit the creator's *concepts* (what they teach, what they review), each with a content-specific playbook and resources. The Architect's job is to hand creators the verb templates and help them develop each one better. That is the service.

## 1. Getting expertise out of an expert (the interview is the product)

**Why this is the hard part.** Expert systems (1980–95) died on exactly this: the *knowledge acquisition bottleneck*. Experts could not articulate the tacit knowledge behind their best decisions, and the people doing the elicitation had to become experts themselves ([Cullen 1988](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1468-0394.1988.tb00065.x); [what happened with expert systems](https://towardsdatascience.com/what-happened-with-expert-systems-aad399eab180/)). Feigenbaum: "The bottleneck in building expert systems is the knowledge acquisition bottleneck." Two things are different now: the LLM does the eliciting (no knowledge engineer), and the output is a playbook the LLM applies with judgment, not brittle rules.

**A method exists.** Cognitive Task Analysis, specifically *Applied CTA* (Militello & Hutton 1998), was built so non-psychologists could extract tacit expertise in a few interviews ([ACTA toolkit](https://pubmed.ncbi.nlm.nih.gov/9819578/); [Commoncog summary](https://commoncog.com/an-easier-method-for-extracting-tacit-knowledge/); [Brown, Power, Gore 2025 review](https://journals.sagepub.com/doi/10.1177/10944281241271216)). Four steps:

| ACTA step | What it produces | Our equivalent |
|---|---|---|
| Task diagram | 3–6 subtasks; which ones need judgment | The verb's **process** section (phases with done-when) |
| Knowledge audit | Probes that surface tacit cues | The **rules with reasons** + **intake distinctions** |
| Simulation interview | Walk one real scenario step by step: cues, decisions, errors | The **worked example** + the first eval case |
| Cognitive demands table | Cross-expert synthesis: task · cues · errors | The concept's **common mistakes I correct** |

The knowledge-audit probes are the interview questions the Architect should be asking, near-verbatim:
- *Big picture:* "What is important about the big picture for this task?"
- *Noticing:* "Have you had experiences where part of a situation just popped out at you, where you noticed things others didn't?"
- *Past & future:* "Is there a time you walked into the middle of a situation and knew how it got there and where it was headed?"
- *Job smarts:* "Are there ways of working smart, accomplishing more with less?"
- *Improvising:* "An example when you improvised or noticed an opportunity?"
- *Self-monitoring:* "A time you realised you needed to change the way you were doing it?"
- *Anomalies:* "How do you spot that something is off?"

Our Architect currently asks about rules, refusals, always-ask-first questions, and one real case. It does not ask *noticing*, *anomalies*, or *improvising*, which is where the "opinions money can't google" live.

**Knowledge conversion framing.** Nonaka's SECI model names our loop: *externalization* (tacit → explicit) is the Architect interview; *combination* (explicit → explicit) is the playbook + resources; *internalization* is the persona applying it; *socialization* is the client conversation that generates new tacit knowledge the creator feeds back ([SECI overview](https://en.wikipedia.org/wiki/SECI_model_of_knowledge_dimensions); [operationalization study](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.02730/full)). The loop only closes if creators come back with corrections; the case studies show that one revision session moved scores more than the initial build.

## 2. Verb taxonomies that already exist

**Bloom's revised taxonomy** (Anderson & Krathwohl 2001) is the canonical verb ladder: remember, understand, apply, analyze, evaluate, create, each with measurable action verbs ([overview](https://www.simplypsychology.org/blooms-taxonomy.html); [verb lists](https://www.eiu.edu/instructional_design/blooms_revised_taxonomy_2001_for_action_verbs.php)). It is a taxonomy of what a *learner* does. Ours is what an *expert does for a client*, which is a different axis, but Bloom gives two things: (a) a precedent that a small fixed verb set with measurable outcomes works at scale, and (b) a mapping for @teach: a concept is taught to a Bloom level, and the "check" in a concept playbook is the measurable verb at that level.

**ICF coaching competencies** define @coach as a profession: establish agreements, active listening, evoke awareness, facilitate growth with goals, actions, and accountability ([ICF 2025 competencies](https://coachingfederation.org/credentialing/coaching-competencies/icf-core-competencies/)). The GROW model (Goal, Reality, Options, Will) is the session shape ([coaching models](https://tandemcoach.co/coaching-models/)). This validates the @coach template: intake = agreement + goal, process = reality → options → will, output = actions + accountability, and it tells us @coach must be the client doing the work, which the Arjun sessions already showed.

**Our v1 verb set** (14): explain, assess, analyze · advise, mentor · plan, draft, research · teach, review, rehearse, coach · guide, track. Bloom covers the first group's cognitive side; ICF covers coach; review and assess map to Bloom's *evaluate*; draft and plan to *create*.

## 3. How agent skills are structured today

Anthropic's Agent Skills are the closest technical precedent and match our runtime: a SKILL.md with name + description (the description is what triggers the skill), a body under ~500 lines, and *progressive disclosure*: reference files loaded only when needed ([Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview); [authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)). Two rules from that guide we should adopt verbatim: workflows as checklists the agent can copy and tick, and *evaluation-driven authoring*: design the tests before writing the skill, and iterate with one agent authoring while another is tested with it. That is our Architect + test_persona loop.

Implication for verb skills: `/skills/teach/SKILL.md` is the creator's generic teaching playbook plus a concept index; `/skills/teach/concepts/<concept>.md` is loaded only when that concept is in play. This is exactly progressive disclosure, so the runtime needs no change.

## 4. Products doing expert replication

**Delphi** ("digital mind") is the direct reference: connect your content (books, podcasts, videos), get a clone that answers in your voice and cites sources, deploy on web/Slack/voice ([Delphi](https://www.delphi.ai/); [AssemblyAI case study](https://www.assemblyai.com/customers/delphi-customer-story)). Its model is *knowledge-first*: ingest content, answer questions. It does not train verbs: no intake, no process, no outcome. Delphi is @explain done well. Our difference is the other thirteen verbs, and the interview that produces them when the creator has no content library (most coaches don't).

**Topmate** (see the case studies) sells the human's time. Neither product has a playbook a client can be walked through, which is the gap the verb skills fill.

## 5. Validating the concept: golden sets and human review

The eval literature is unusually clear on method ([Hamel Husain, evals FAQ](https://hamel.dev/blog/posts/evals-faq/); [LLM-as-judge guide](https://hamel.dev/blog/posts/llm-judge/); [judge calibration](https://galileo.ai/blog/calibrate-llm-judge-human-annotations)):

1. **One principal domain expert** owns the standard for a creator (that is the creator). Not a committee.
2. **Binary pass/fail per criterion, with a written critique.** Our 0–3 rubric was useful for trend-watching but Hamel's argument holds: a binary forces "what actually matters", and the critique becomes the few-shot material for the judge.
3. **Start from error analysis, not from a rubric.** Read ~30 real conversations, categorize failures, turn each category into a test. Our round-1 failures (promised sends, dropped hand-off, advised before intake, fabricated metrics) are exactly such categories.
4. **Calibrate the judge against human labels** and report TPR/TNR separately, not raw agreement. Recalibrate on every material change (model, prompt, skill edit).
5. **Golden sets are small and curated:** roughly 30 to discover failure modes, ~100 per failure type to validate the judge ([evaluation-driven development](https://vinitshahdeo.substack.com/p/evaluation-driven-development-llm-testing)).

What this means for us: the hypothesis for a verb skill is a golden set of expectations *written by the creator*, in the form "given this client opening, the persona must / must not …", with pass/fail and a critique. The Architect can draft the set from the worked example and the boundaries; the creator edits it once (plan-then-approve, same as the playbook). The judge grades against it; the creator spot-checks the judge on a sample and their corrections re-tune it.

## Open questions to settle next
- Is a verb skill *one* SKILL.md per verb per creator (my current read), or can a creator have two @teach skills for very different audiences? (Recommendation: one; audiences are intake distinctions.)
- Which ACTA probes go in the generic verb interview vs the per-concept interview? (Recommendation: big picture, job smarts, self-monitoring at verb level; noticing, anomalies, improvising per concept.)
- Golden set granularity: per verb, per concept, or both? (Recommendation: per concept, with 3–5 verb-level cases for intake and boundaries.)
