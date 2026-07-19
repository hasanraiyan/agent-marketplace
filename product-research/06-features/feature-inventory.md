# Feature Inventory — All Three Agents

> **Status:** HYPOTHESIS — grounded in founder specification
> **Date:** July 19, 2026
>
> Every feature traces back to a problem, desired outcome, and solution hypothesis.

---

## Parking Lot (Speculative Ideas)

Features below the main list that don't yet trace to a documented problem are in the **parking lot**.

---

## 🚀 Startup Thinker — Features

### ST-F1: Idea Submission & Deep Challenge

| Field | Detail |
|-------|--------|
| **Feature Name** | Idea Submission & Deep Challenge |
| **Target Persona** | Alex Chen (Startup Thinker Consumer) |
| **Problem Solved** | ST-P1 (Idea validation uncertainty), ST-P2 (Confirmation bias) |
| **Desired Outcome** | ST-O1 (Confident Idea Validation) |
| **Solution Hypothesis** | ST-S1 (Structured Idea Validation Engine) |
| **User Story** | As a founder, I want to describe my startup idea and receive structured, critical questions that challenge each assumption — so I can identify weak points before I invest time building |
| **Expected User Flow** | (1) Founder describes idea → (2) Agent asks structured questions across dimensions (customer, problem, solution, market, differentiation, business model) → (3) Founder responds to each → (4) Agent summarizes key insights, risks, and unknowns |
| **Acceptance Criteria** | Agent asks at least 7 distinct challenge questions across different dimensions. Questions are specific to the founder's idea (not generic templates). Agent documents the founder's responses for future sessions. |
| **Success Metric** | Founder reports "this changed my thinking" or identifies a critical flaw they hadn't considered |
| **Priority** | P0 (Core to the agent) |
| **Dependencies** | Persona AI conversation engine, memory for persistence |
| **Risks** | Founders may feel attacked if questions are too harsh — tone must be direct but constructive |
| **Open Questions** | How do we calibrate the "challenge level" for different founders? |

### ST-F2: Personalized 30-Day Action Plan

| Field | Detail |
|-------|--------|
| **Feature Name** | Personalized 30-Day Action Plan |
| **Target Persona** | Alex Chen |
| **Problem Solved** | ST-P3 (Analysis paralysis) |
| **Desired Outcome** | ST-O2 (Actionable Execution Plan) |
| **Solution Hypothesis** | ST-S2 (Personalized Execution Planning) |
| **User Story** | As a founder, I want a personalized 30-day plan with specific weekly actions — customer interviews, market research tasks, hypothesis tests — saved as a file I can follow |
| **Expected User Flow** | (1) Founder completes idea validation → (2) Agent proposes a 30-day plan based on their specific situation → (3) Founder adjusts priorities → (4) Agent creates and saves plan as `.md` file |
| **Acceptance Criteria** | Plan includes at least 10 actionable tasks across 4 weeks. Each task has a specific outcome (not "talk to users" but "interview 3 founders in X space"). File is downloadable and editable. |
| **Success Metric** | Founder completes ≥3 actions from the plan in the first week |
| **Priority** | P0 |
| **Dependencies** | ST-F1 (Idea Validation must complete first) |
| **Risks** | Plan may be ignored if not specific enough to the founder's situation |
| **Open Questions** | Should plans auto-adjust based on founder progress in future sessions? |

### ST-F3: Customer Interview Question Generator

| Field | Detail |
|-------|--------|
| **Feature Name** | Customer Interview Question Generator |
| **Target Persona** | Alex Chen |
| **Problem Solved** | ST-P1 (Validation uncertainty) |
| **Desired Outcome** | ST-O3 (Clear Next Customer) |
| **Solution Hypothesis** | ST-S1 (Structured Validation Engine) |
| **User Story** | As a founder, I want a set of tailored customer interview questions for my specific idea — so I can avoid leading questions and get honest feedback |
| **Expected User Flow** | (1) Founder describes their idea and target customer → (2) Agent generates 10-15 interview questions that avoid confirmation bias → (3) Agent explains why each question matters → (4) Saves as file |
| **Acceptance Criteria** | Questions are specific to the founder's idea, not generic templates. Questions are designed to surface real problems, not validate assumptions. |
| **Success Metric** | Founder conducts 5+ interviews using the questions |
| **Priority** | P1 |
| **Dependencies** | ST-F1 (Idea Validation) |
| **Risks** | Founders may still ask leading questions despite good question design |
| **Open Questions** | Should the agent "coach" the founder on how to conduct the interview? |

### ST-F4: Competitor & Market Analysis

| Field | Detail |
|-------|--------|
| **Feature Name** | Competitor & Market Analysis |
| **Target Persona** | Alex Chen |
| **Problem Solved** | ST-P1 (Validation uncertainty) |
| **Desired Outcome** | ST-O1 (Confident Idea Validation) |
| **Solution Hypothesis** | ST-S1 (Structured Validation Engine) |
| **User Story** | As a founder, I want my idea analyzed against existing competitors and the broader market — so I understand the competitive landscape and where I fit |
| **Expected User Flow** | (1) Founder describes their idea → (2) Agent researches competitors and market → (3) Agent provides competitive positioning map → (4) Saves as file |
| **Acceptance Criteria** | Analysis identifies at least 3 direct or indirect competitors. Provides differentiation analysis. |
| **Success Metric** | Founder reports new insight about the competitive landscape |
| **Priority** | P1 |
| **Dependencies** | Web research capability |
| **Risks** | May not find competitors if the idea is in a niche space |
| **Open Questions** | Should we let founders add known competitors for the agent to analyze? |

---

## 🌍 Study Abroad Navigator — Features

### SA-F1: Comprehensive Student Profile

| Field | Detail |
|-------|--------|
| **Feature Name** | Comprehensive Student Profile |
| **Target Persona** | Priya Sharma (Study Abroad Navigator Consumer) |
| **Problem Solved** | SA-P1 (No single source of truth) |
| **Desired Outcome** | SA-O1 (Complete Journey Ownership) |
| **Solution Hypothesis** | SA-S1 (Complete Journey Orchestration) |
| **User Story** | As a student, I want to build a complete profile (academics, budget, goals, preferences) that the agent remembers across sessions — so I don't have to repeat myself and all recommendations are personalized to me |
| **Expected User Flow** | (1) Student answers profile questions (degree, CGPA, budget, preferred countries, career goals) → (2) Agent stores profile as memory → (3) All future recommendations are based on this profile |
| **Acceptance Criteria** | Profile captures: education, CGPA, test scores (if any), budget range, preferred countries, career goals, timeline, research experience, work experience, projects. Profile persists across sessions. |
| **Success Metric** | Student completes profile (≥80% of fields) |
| **Priority** | P0 |
| **Dependencies** | Memory/storage system |
| **Risks** | Students may be reluctant to share financial details |
| **Open Questions** | Should we support profile editing and refinement? |

### SA-F2: University & Country Matching

| Field | Detail |
|-------|--------|
| **Feature Name** | University & Country Matching |
| **Target Persona** | Priya Sharma |
| **Problem Solved** | SA-P1 (No single source of truth) |
| **Desired Outcome** | SA-O1 (Complete Journey Ownership), SA-O2 (Personalized Match) |
| **Solution Hypothesis** | SA-S1 (Journey Orchestration), SA-S2 (Modular 22 Skills) |
| **User Story** | As a student, I want personalized recommendations for countries and universities that match my profile — with clear reasons why they fit me |
| **Expected User Flow** | (1) Agent uses student profile → (2) Agent runs country selection + university shortlisting skills → (3) Agent explains match rationale → (4) Student can ask follow-ups |
| **Acceptance Criteria** | Recommends 3-5 countries and 5-10 universities with match rationale. Recommendations are based on the student's specific profile. |
| **Success Metric** | Student finds ≥2 universities they're excited about that they hadn't considered |
| **Priority** | P0 |
| **Dependencies** | SA-F1 (Student profile), Study Abroad knowledge base |
| **Risks** | Recommendations may be inaccurate if knowledge base is outdated |
| **Open Questions** | Should students rate/feedback on recommendations to improve them? |

### SA-F3: Scholarship Matching

| Field | Detail |
|-------|--------|
| **Feature Name** | Scholarship Matching |
| **Target Persona** | Priya Sharma |
| **Problem Solved** | SA-P2 (Financial uncertainty) |
| **Desired Outcome** | SA-O2 (Personalized Match) |
| **Solution Hypothesis** | SA-S1 (Journey Orchestration), SA-S3 (KB + Web Hybrid) |
| **User Story** | As a student, I want scholarships that match my specific profile (country, field, grades, background) — prioritized by match strength and deadline — so I can maximize my funding chances |
| **Expected User Flow** | (1) Agent matches student profile to scholarship database → (2) Agent prioritizes by fit and deadline → (3) Agent explains how to apply for each → (4) Agent tracks application progress |
| **Acceptance Criteria** | Matches at least 5 scholarships per student. Priority by deadline and fit. Application instructions for each. |
| **Success Metric** | Student applies to ≥3 matched scholarships |
| **Priority** | P0 |
| **Dependencies** | SA-F1 (Student profile), Scholarship data (KB + web research) |
| **Risks** | Scholarship information becomes outdated; web research must verify |
| **Open Questions** | Should we integrate with scholarship portals directly? |

### SA-F4: Personalized Journey Roadmap

| Field | Detail |
|-------|--------|
| **Feature Name** | Personalized Journey Roadmap |
| **Target Persona** | Priya Sharma |
| **Problem Solved** | SA-P1 (No single source of truth), SA-P3 (Visa anxiety) |
| **Desired Outcome** | SA-O1 (Complete Journey Ownership), SA-O3 (Stress-Free Visa) |
| **Solution Hypothesis** | SA-S1 (Journey Orchestration), SA-S2 (Modular 22 Skills) |
| **User Story** | As a student, I want a complete roadmap from today until departure — with monthly actions, deadlines, and checklists — saved as a file I can follow |
| **Expected User Flow** | (1) Agent has student profile + matched universities → (2) Agent runs orchestrator skill → (3) Agent determines which skills to activate based on timeline → (4) Agent creates comprehensive roadmap → (5) Saves as file |
| **Acceptance Criteria** | Roadmap covers: tests, applications, SOP, LORs, scholarships, finances, visa, accommodation, pre-departure. Monthly breakdown from today to departure. File is downloadable and editable. |
| **Success Metric** | Student returns monthly to check progress against roadmap |
| **Priority** | P0 |
| **Dependencies** | SA-F1, SA-F2, SA-F3, all 22 skills |
| **Risks** | Roadmap may be too long/generic if not personalized enough |
| **Open Questions** | Should roadmap adapt based on progress reported in future sessions? |

### SA-F5: Visa Process Guide

| Field | Detail |
|-------|--------|
| **Feature Name** | Visa Process Guide |
| **Target Persona** | Priya Sharma |
| **Problem Solved** | SA-P3 (Visa anxiety) |
| **Desired Outcome** | SA-O3 (Stress-Free Visa) |
| **Solution Hypothesis** | SA-S1 (Journey Orchestration), SA-S3 (KB + Web Hybrid) |
| **User Story** | As a student, I want a personalized visa checklist for my target country — with current requirements, document list, and step-by-step instructions — so I can prepare without fear of mistakes |
| **Expected User Flow** | (1) Student selects target country → (2) Agent researches current visa requirements via web → (3) Agent creates step-by-step checklist → (4) Agent tracks document readiness |
| **Acceptance Criteria** | Checklist is country-specific. Uses official sources. Includes document list, timeline, application steps, common mistakes. |
| **Success Metric** | Student submits complete visa application without major errors |
| **Priority** | P1 |
| **Dependencies** | Web research, knowledge base |
| **Risks** | Visa policies change frequently; accuracy is critical |
| **Open Questions** | Should we include a "disclaimer" about consulting official sources? |

---

## 💼 Career Launchpad — Features

### CL-F1: Candidate Profile Assessment

| Field | Detail |
|-------|--------|
| **Feature Name** | Candidate Profile Assessment |
| **Target Persona** | Jordan Williams (Career Launchpad Consumer) |
| **Problem Solved** | CL-P1 (Unclear career direction), CL-P2 (Skill gap uncertainty) |
| **Desired Outcome** | CL-O1 (Clear Career Direction), CL-O2 (Honest Gap Analysis) |
| **Solution Hypothesis** | CL-S1 (Holistic Readiness Assessment) |
| **User Story** | As a student, I want the agent to build a complete picture of my skills, experience, projects, and goals — so I get personalized recommendations, not generic advice |
| **Expected User Flow** | (1) Student shares their background → (2) Agent builds profile across: skills, internships, projects, GitHub, resume, career goal → (3) Agent stores profile as memory → (4) All future recommendations are personalized |
| **Acceptance Criteria** | Profile captures: technical skills, soft skills, work experience, projects, GitHub/portfolio links, resume, target role, education. Profile persists across sessions. |
| **Success Metric** | Student completes profile (≥80% of fields) |
| **Priority** | P0 |
| **Dependencies** | Memory/storage system |
| **Risks** | Students may inflate their skills; agent should verify through specific questions |
| **Open Questions** | Should we support skills assessment quizzes? |

### CL-F2: Skill Gap Analysis with Market Comparison

| Field | Detail |
|-------|--------|
| **Feature Name** | Skill Gap Analysis with Market Comparison |
| **Target Persona** | Jordan Williams |
| **Problem Solved** | CL-P2 (Skill gap uncertainty) |
| **Desired Outcome** | CL-O2 (Honest Gap Analysis) |
| **Solution Hypothesis** | CL-S1 (Holistic Readiness Assessment) |
| **User Story** | As a student, I want my current skills compared against what companies actually require for my target role — so I know exactly what I'm missing and what to prioritize |
| **Expected User Flow** | (1) Agent has student profile + target role → (2) Agent researches current job requirements via web → (3) Agent compares student profile vs. market → (4) Agent outputs prioritized gap analysis |
| **Acceptance Criteria** | Analysis covers: technical skills (specific technologies/frameworks), soft skills, experience level, portfolio quality. Gaps are prioritized by importance. Based on real job postings. |
| **Success Metric** | Student reports "this is surprisingly accurate" and acts on the top 3 gaps |
| **Priority** | P0 |
| **Dependencies** | CL-F1 (Candidate profile), web research |
| **Risks** | Market data may be skewed toward senior roles; must filter for entry-level |
| **Open Questions** | How often should market research refresh? |

### CL-F3: Resume Analysis & Optimization

| Field | Detail |
|-------|--------|
| **Feature Name** | Resume Analysis & Optimization |
| **Target Persona** | Jordan Williams |
| **Problem Solved** | CL-P3 (No honest resume feedback) |
| **Desired Outcome** | CL-O2 (Honest Gap Analysis) |
| **Solution Hypothesis** | CL-S1 (Holistic Readiness Assessment) |
| **User Story** | As a student, I want specific, honest feedback on my resume — including ATS compatibility, content quality, and comparison to what recruiters expect — so I can fix what's holding me back |
| **Expected User Flow** | (1) Student uploads/sharing resume → (2) Agent analyzes: content, ATS keywords, structure, impact → (3) Agent provides specific improvement suggestions → (4) Agent can help rewrite sections |
| **Acceptance Criteria** | Analysis covers: ATS keyword match, quantified achievements, action verbs, structure, length, missing sections. Provides specific rewrite suggestions, not generic feedback. |
| **Success Metric** | Resume gets ≥3 interview callbacks after optimization |
| **Priority** | P0 |
| **Dependencies** | Resume text parsing |
| **Risks** | ATS analysis is partially guesswork — different ATS systems behave differently |
| **Open Questions** | Should we offer version comparison (before vs. after)? |

### CL-F4: Mock Interview Simulator

| Field | Detail |
|-------|--------|
| **Feature Name** | Mock Interview Simulator |
| **Target Persona** | Jordan Williams |
| **Problem Solved** | CL-P4 (Interview anxiety) |
| **Desired Outcome** | CL-O3 (Interview Confidence) |
| **Solution Hypothesis** | CL-S3 (Simulated Interview Practice) |
| **User Story** | As a student, I want to practice realistic interviews for my target role — technical, behavioral, system design — and get specific feedback on my answers |
| **Expected User Flow** | (1) Student selects interview type (technical, behavioral, system design, HR) → (2) Agent conducts mock interview with realistic questions → (3) Student answers → (4) Agent provides specific feedback on each answer |
| **Acceptance Criteria** | Questions are specific to the student's target role (not generic). At least 5 questions per mock session. Feedback on: content, structure, clarity, completeness. Can rerun with different questions. |
| **Success Metric** | Student reports "I felt much more prepared after practicing" |
| **Priority** | P1 |
| **Dependencies** | None critical |
| **Risks** | Text-based mock interviews may feel less realistic than voice/video |
| **Open Questions** | Should we eventually support voice-based mock interviews? |

### CL-F5: 6-Month Career Roadmap

| Field | Detail |
|-------|--------|
| **Feature Name** | 6-Month Career Roadmap |
| **Target Persona** | Jordan Williams |
| **Problem Solved** | CL-P1 (Unclear direction), CL-P2 (Skill gaps), CL-P4 (Interview anxiety) |
| **Desired Outcome** | CL-O1 (Clear Direction), CL-O2 (Gap Analysis), CL-O3 (Interview Confidence) |
| **Solution Hypothesis** | CL-S2 (42-Skill Architecture) |
| **User Story** | As a student, I want a comprehensive 6-month plan: what to learn, what projects to build, how to improve my resume and GitHub, when to start applying, and how to prepare for interviews |
| **Expected User Flow** | (1) Agent has profile + gap analysis → (2) Agent runs orchestrator skill → (3) Agent activates relevant skills → (4) Agent creates complete roadmap → (5) Saves as file |
| **Acceptance Criteria** | Roadmap covers: skill development (month-by-month), projects to build, resume/GitHub optimization, job search milestones, interview prep timeline. File is downloadable. |
| **Success Metric** | Student follows roadmap for ≥3 months and reports progress |
| **Priority** | P0 |
| **Dependencies** | CL-F1, CL-F2, CL-F3, CL-F4 |
| **Risks** | 6-month plan may be too long for students with immediate graduation |
| **Open Questions** | Should we support adjustable timeframes (3-month, 6-month, 12-month)? |

---

## Features → Traceability Map

| Feature | Problem | Outcome | Priority |
|---------|---------|---------|----------|
| ST-F1: Idea Deep Challenge | ST-P1, ST-P2 | ST-O1 | P0 |
| ST-F2: 30-Day Action Plan | ST-P3 | ST-O2 | P0 |
| ST-F3: Interview Questions | ST-P1 | ST-O3 | P1 |
| ST-F4: Competitor Analysis | ST-P1 | ST-O1 | P1 |
| SA-F1: Student Profile | SA-P1 | SA-O1 | P0 |
| SA-F2: University Matching | SA-P1 | SA-O1, SA-O2 | P0 |
| SA-F3: Scholarship Matching | SA-P2 | SA-O2 | P0 |
| SA-F4: Journey Roadmap | SA-P1, SA-P3 | SA-O1, SA-O3 | P0 |
| SA-F5: Visa Guide | SA-P3 | SA-O3 | P1 |
| CL-F1: Candidate Assessment | CL-P1, CL-P2 | CL-O1, CL-O2 | P0 |
| CL-F2: Skill Gap Analysis | CL-P2 | CL-O2 | P0 |
| CL-F3: Resume Optimization | CL-P3 | CL-O2 | P0 |
| CL-F4: Mock Interview | CL-P4 | CL-O3 | P1 |
| CL-F5: Career Roadmap | CL-P1, CL-P2, CL-P4 | CL-O1, CL-O2, CL-O3 | P0 |

---

## Parking Lot (Speculative Features)

| Feature | Why Speculative |
|---------|----------------|
| Voice-based mock interviews | No documented need for voice vs. text |
| Direct scholarship application integration | High complexity, low student trust in automated submissions |
| Startup idea database/matching (like Product Hunt) | Different product altogether |
| Study abroad peer matching (connect with alumni) | Community feature — may distract from core agent value |
| Career progress tracking dashboard (long-term) | Requires ongoing engagement beyond initial job search |
| Multi-language support (for study abroad) | Could expand reach but adds significant complexity |
| Creator lead generation marketplace | Future plan, not immediate feature |
