/** The System Design Firm — a curriculum with measurable readiness and human-graded mocks. */
export default {
  owner: { name: 'Ravi Menon', email: 'ravi@menon-systems.dev', slug: 'ravi-menon' },
  firm: {
    name: 'Menon Systems School',
    tagline: 'Interview-ready in 12 weeks, graded by someone who has run 300 system design interviews.',
    bio: 'Staff engineer, fourteen years, and roughly three hundred system design interviews conducted at two large tech companies. I know exactly where candidates lose the room, and it is almost never the technology. My firm runs a 12-week curriculum built from my mental models: one design problem a week reviewed against my rubric in my voice, spaced repetition on your weak areas, and four mock interviews where I show up and grade you the way I actually would.',
    category: 'technology',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=menon&backgroundColor=ea580c',
    expertise: ['System design interviews', 'Numbers before boxes', 'Trade-off articulation', 'Distributed data', 'Staff-level scoping', 'Mock interviews'],
    mandate: {
      takes: [
        'Engineers with 3+ years targeting senior or staff interviews at large tech companies in the next 3–6 months',
        'People who will do one written design a week',
      ],
      refuses: [
        'Guaranteeing an offer',
        'Coding interview prep (algorithms) — different firm, different muscle',
        'Cramming in under four weeks; the method needs repetition',
      ],
      clientProfile: 'A working engineer who freezes or rambles in design rounds and wants a measurable path out of it.',
    },
    proof: [
      { quote: '"Numbers before boxes" fixed my interviews. I stopped drawing Kafka on slide one.', author: 'Senior engineer', role: 'Offer at a FAANG' },
      { quote: 'The weekly verdicts were brutal and exactly what my real interviewer later said.', author: 'Backend engineer', role: 'Staff offer' },
    ],
  },
  skills: {
    rubric: {
      name: 'system-design-interview-rubric',
      title: 'System design interview rubric',
      hook: 'Your design graded on six dimensions with the verdict a real interviewer would give you.',
      category: 'technology',
      description: 'Menon\'s rubric for grading a system design answer, with the verdicts in his voice. Use for reviewing any design writeup or mock.',
      instructions: `# System design interview rubric

Six dimensions, each scored 0–3. Senior bar is 12+, staff bar is 15+ with no zeros. The score matters less than the verdict sentence; write both.

1. **Requirements and scope (0–3).** Did they turn a vague prompt into functional and non-functional requirements with explicit exclusions in under five minutes? Verdict examples: "You designed for features nobody asked for." / "You scoped like a staff engineer: three things in, four things out, and you said why."
2. **Numbers (0–3).** Did they estimate users, QPS, storage, and read/write ratio before drawing anything? Rule: numbers before boxes. Verdict: "You jumped to sharding before defining the read/write ratio — my rule: numbers before boxes."
3. **High-level design (0–3).** A clean first diagram that a colleague could implement from, with data flow for the two main operations. Verdict: "Your diagram has eleven boxes and no arrows. An interviewer cannot follow it and neither can you."
4. **Data model and storage choice (0–3).** Schema for the core entities, the access patterns, and a storage choice justified by those patterns rather than by fashion.
5. **Deep dive and trade-offs (0–3).** Picked the hardest component and went deep; named at least two alternatives and why they lost. Verdict: "You said 'we could use a cache' four times. Which cache, keyed on what, invalidated how?"
6. **Communication and driving (0–3).** Did they drive the conversation, check in, and handle the interviewer's push-back without collapsing or arguing?

## Common failure patterns (name them explicitly in reviews)
- **Technology-first:** names tools before problems. Fix: ban tool names for the first ten minutes.
- **Breadth without depth:** touches everything, owns nothing. Fix: pick one component and go three levels down.
- **No numbers:** everything is "scalable". Fix: three estimates written down before the diagram.
- **Silent drawing:** draws for four minutes without speaking. Fix: narrate every box as it appears.

## Review output format
Score table, then a verdict paragraph in the first person as the interviewer, then the single highest-leverage fix for next week, then a rewritten version of their weakest section showing what "3" looks like.`,
    },
    method: {
      name: 'numbers-before-boxes-method',
      title: 'Numbers before boxes',
      hook: 'The first fifteen minutes of a design interview, drilled until scoping and estimation are habits.',
      category: 'technology',
      description: 'The step-by-step method Menon teaches for the first 15 minutes of any design interview, with the estimation shortcuts. Use when teaching, drilling, or reviewing the opening of a design.',
      instructions: `# Numbers before boxes: the first fifteen minutes

Minute 0–5 — Scope. Restate the prompt. List functional requirements (three to five). List non-functional requirements with a number each (latency target, availability, consistency need). List explicit exclusions. Ask two clarifying questions maximum, then decide and move on. Reason: interviewers grade decisiveness under ambiguity; endless questions read as stalling.

Minute 5–10 — Numbers. Write down: daily active users; reads and writes per second (peak = 3× average); storage per year (records × size × retention); bandwidth if media is involved. Shortcuts: 1 million/day ≈ 12/second; 86,400 seconds/day rounds to 100k; 1 KB × 1 billion = 1 TB. Say the read/write ratio out loud; it decides the whole architecture. Reason: every storage, caching, and replication decision later is justified by these numbers or it is guessing.

Minute 10–15 — The first diagram. Client → API/gateway → service(s) → storage, with the two main operations drawn as numbered arrows. No queues, no caches, no CDN yet. Reason: the first diagram earns the right to add complexity; complexity added first is unjustified.

Only after minute 15: bottlenecks, then the deep dive.

## Drill format (weekly)
One prompt. The client writes the fifteen-minute opening as a document (scope, numbers, first diagram in text or ASCII) in under 20 minutes, timed, then the rest of the design in 40 minutes. The review grades the opening separately from the rest, because the opening is where most points are lost.`,
    },
    curriculum: {
      name: 'twelve-week-curriculum-and-tracking',
      title: '12-week curriculum & readiness score',
      hook: 'One problem a week in the right order, weak areas drilled on a schedule, and a number that says when you are ready.',
      category: 'technology',
      description: 'The 12-week curriculum structure, weekly problem sequence, weak-area tracker with spaced repetition, and the readiness score. Use for plans, trackers, and progress reports.',
      instructions: `# Twelve-week curriculum and tracking

## Sequence (one problem a week, difficulty rising)
1. URL shortener (scope + numbers discipline)
2. Rate limiter (a small system, deep trade-offs)
3. News feed (fan-out on read vs write)
4. Chat system (real-time, ordering, delivery guarantees)
5. Search autocomplete (data structures meet distribution)
6. File storage / sync (chunking, dedup, consistency)
7. Ride matching or location service (geo indexing)
8. Notification system (queues, retries, idempotency)
9. Payment / ledger (consistency, exactly-once, audit)
10. Video streaming (media pipeline, CDN)
11. Metrics / logging platform (write-heavy, time series)
12. Candidate's choice, full mock conditions

Reason for the order: each week introduces one new distributed-systems concept on top of the previous ones; jumping to week 9 in week 2 produces cargo-cult answers.

## Weak-area tracker (spaced repetition)
After each review, log every dimension scored 0 or 1 as a weak area with the specific failure ("no read/write ratio", "silent drawing"). Each weak area gets a 10-minute micro-drill scheduled at +3 days, +7 days, +14 days. It is retired after three consecutive clean drills. Reason: the rubric dimensions are habits; habits need spaced reps, not another lecture.

## Readiness score (reported weekly)
Average of the last three rubric totals, adjusted: minus 2 if any dimension scored 0 in the last two weeks. Senior-ready at 12, staff-ready at 15. Report the score, the trend, and the one thing moving it.

## Mock interviews
Weeks 3, 6, 9, 12: a 45-minute mock graded by the human coach on the same rubric. The firm prepares a one-page brief for the coach before each: readiness score, open weak areas, last two verdicts.

## Weekly report format
Readiness score and trend · this week's rubric table · verdict · weak areas (new / due / retired) · next week's problem and micro-drills.`,
    },
  },
  employees: {
    frontdesk: {
      name: 'Kai at Menon Systems',
      title: 'Front desk',
      mandate: 'Explains the method and the program, answers quick system design questions with the firm\'s opinions, and steers serious candidates to the 12-week program.',
      facing: 'client',
      isFrontDesk: true,
      description: 'First conversation at Menon Systems School.',
      systemPrompt: `You are Kai, the front desk of Menon Systems School, a one-person AI-native firm run by Ravi Menon, a staff engineer who has conducted about 300 system design interviews.

- Answer quick system design questions with the firm's opinions and reasons (numbers before boxes; scope before tools). Be a little blunt, like Ravi.
- When someone describes freezing or rambling in design rounds, describe the "Interview-ready in 12 weeks" program concretely: one problem a week, rubric reviews in Ravi's voice, spaced weak-area drills, four human-graded mocks, a readiness score.
- We never guarantee offers and we do not do algorithm prep. Say so when relevant.
- Short, direct. One question at a time.`,
      skills: ['rubric', 'method'],
    },
    lead: {
      name: 'Curriculum Lead',
      title: 'Curriculum lead',
      mandate: 'Runs the 12-week program: baseline assessment, curriculum, weekly problem and review, weak-area tracker, readiness score, mock briefs. Delegates reviews; owns every deliverable.',
      facing: 'client',
      description: 'Runs your 12 weeks and reports your readiness.',
      systemPrompt: `You are the Curriculum Lead at Menon Systems School. You run a candidate's 12-week program against a signed scope of work, applying Ravi Menon's rubric, method, and curriculum.

How you work:
- Read the scope and the candidate's inputs (level, targets, weekly hours, sample writeup). Start with the baseline assessment using the sample writeup; if no sample exists, assign week-1's problem as the baseline and say so.
- Delegate every design review to the "drill-reviewer" with the writeup and the rubric; you add the readiness score, update the weak-area tracker, and write the weekly report.
- Before each mock week (3, 6, 9, 12) produce the one-page coach brief.
- Every deliverable is a complete markdown file in /workspace/outputs/, presented to the candidate. Keep the weak-area tracker as a living file.
- Tone: Ravi's voice — direct, specific, no praise without a reason. Never guarantee an offer.
- Client messages: short. What was graded, the score, the one fix, what is due.`,
      skills: ['rubric', 'method', 'curriculum'],
    },
    reviewer: {
      name: 'Drill Reviewer',
      title: 'Drill reviewer',
      mandate: 'Grades design writeups against the rubric and writes the verdict in Ravi\'s voice, plus the rewritten weakest section. Internal only.',
      facing: 'internal',
      description: 'Grades like the interviewer will.',
      systemPrompt: `You are the Drill Reviewer at Menon Systems School, an internal specialist. You receive a design writeup and return a review in the rubric format: the six-dimension score table, a first-person verdict paragraph as the interviewer, the single highest-leverage fix, and a rewritten version of the weakest section showing what a 3 looks like. Name failure patterns explicitly. Grade the first fifteen minutes separately. Write the review to /workspace/outputs/reviews/ and return the file path, total score, and the fix.`,
      skills: ['rubric', 'method'],
    },
  },
  projects: [
    {
      title: 'Interview-ready in 12 weeks',
      outcome: 'A baseline score, a 12-week curriculum, one rubric-graded design review every week in Ravi\'s voice, a weak-area tracker with spaced drills, four human-graded mocks, and a readiness score you can trust.',
      summary: 'Measurable system design readiness, one problem a week, graded the way the real interview will grade you.',
      description: `Design interviews are lost in the first fifteen minutes, on scope and numbers, long before the technology comes up. This program drills that opening until it is a habit, then builds depth week by week.

**Week 1 — Baseline.** Your sample writeup (or week-1's problem) graded on the six-dimension rubric. You get a score, a verdict, and the one fix.

**Every week — The loop.** One problem, timed. A review in Ravi's voice with a rewritten weakest section. Weak areas logged and drilled at +3, +7, +14 days. A readiness score reported every week.

**Weeks 3, 6, 9, 12 — Mocks.** Ravi interviews you for 45 minutes and grades you on the same rubric, with a brief prepared by the firm so the session is pure judgment.`,
      whoFor: [
        'You have 3+ years and design rounds are where you lose offers',
        'You either freeze on the blank whiteboard or name Kafka in the first minute',
        'You will write one design a week for 12 weeks',
        'You want a number that tells you when you are ready',
      ],
      deliverables: [
        { name: 'Baseline assessment', acceptanceCriteria: 'Rubric table, verdict, one fix, starting readiness score' },
        { name: '12-week curriculum', acceptanceCriteria: 'Weekly problems in sequence with the concept each introduces and mock weeks marked' },
        { name: 'Week-1 design review', acceptanceCriteria: 'Full review in the rubric format with a rewritten weakest section' },
        { name: 'Weak-area tracker', acceptanceCriteria: 'Every weak area with specific failure and scheduled micro-drills' },
        { name: 'Weekly readiness report', acceptanceCriteria: 'Score, trend, rubric table, verdict, weak areas, next problem' },
      ],
      durationDays: 84,
      price: { amount: 149, currency: 'USD', period: 'monthly' },
      inputs: [
        { key: 'level', label: 'Current role, years of experience, and target level', type: 'text', required: true, placeholder: 'e.g. Senior backend, 6 years, targeting staff' },
        { key: 'targets', label: 'Target companies and interview timeline', type: 'text', required: true, placeholder: '' },
        { key: 'hours', label: 'Hours per week you can commit', type: 'text', required: true, placeholder: 'e.g. 5' },
        { key: 'sample', label: 'Paste a design you have written (any prompt, any length)', type: 'textarea', required: false, placeholder: 'This becomes your baseline. If you have none, we assign one.' },
      ],
      checkpoints: ['Ravi runs and grades a 45-minute mock in weeks 3, 6, 9, and 12'],
      lead: 'lead',
      employees: ['reviewer'],
      skills: ['rubric', 'method', 'curriculum'],
      instructions: `Baseline first, from the sample if present. Delegate the grading to the drill-reviewer with the rubric; you write the readiness score and the tracker. Then the curriculum, then week-1's review when the candidate submits. Keep the tracker as a living file. Never guarantee an offer. Mark deliverables in_progress and delivered; present each file.`,
      status: 'published',
    },
  ],
};
