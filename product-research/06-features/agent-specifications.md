# Agent Specifications — Career Launchpad (Primary) / Other Agents (Archived)

> **🔄 Updated Framing (July 2026):** persona.hasanraiyan.me is an **agent marketplace + agent creation platform**.
> **💼 Career Launchpad** is a **reference/dogfooding agent** built _on_ persona.hasanraiyan.me using its agent-building system,
> NOT a redefinition of the product. Its full specification is preserved below as it validates the agent-building platform.
> The 🚀 Startup Thinker and 🌍 Study Abroad Navigator specs below are **archived for reference only**.

> **Status:** FACT — defined by founder
> **Date:** July 19, 2026

---

# Core Architecture (Shared Across All Agents)

Each agent is NOT just a `System Prompt + LLM`. Instead, each agent has:

```
Persona & Instructions
↓
Specialized Skills (Skill Files)
↓
Knowledge Base
↓
User Context / Memory
↓
Web Research
↓
Tools
↓
Sub-agents
↓
Deep Reasoning
↓
File System / Artifacts
```

The user starts with a messy real-world problem, and the agent:
**understands → researches → reasons → plans → creates**

---

# 🚀 Agent 1: The Startup Thinker (⚠️ ARCHIVED)

> _This agent is parked. The spec is preserved for future reference._

## Purpose

Help founders go from **"I have an idea"** to **"I know what assumptions I need to test and what I should do next."**

## Tagline

> Think bigger, question assumptions, and turn bold ideas into things people truly want.

## Bio

An AI startup mentor inspired by the thinking of visionary entrepreneurs, built to challenge assumptions, sharpen ideas, and help turn ambitious concepts into real-world products.

## Personality

- Analytical · Direct · Curious · Bold · Witty

## How It Works

A founder comes to the agent: _"I have an AI startup that creates personalized courses for students."_

The Startup Thinker doesn't say "Great idea!" — it starts thinking like a critical startup advisor:

- Who exactly is the customer?
- What painful problem are you solving?
- Why would someone switch?
- What are they doing today?
- Is this a real pain or just a cool feature?
- Will people pay?
- How can we test this assumption?

## Capabilities

| Capability                | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| **Idea Validation**       | Analyze whether the problem is real                                         |
| **Customer Discovery**    | Define who the first users should be                                        |
| **Market Research**       | Research competitors and existing solutions                                 |
| **Positioning**           | Turn a broad idea into a focused value proposition                          |
| **MVP Planning**          | Identify the smallest thing worth building                                  |
| **Distribution Strategy** | Figure out where the first users might come from                            |
| **Founder Strategy**      | Help technical founders balance building and talking to users               |
| **Execution Planning**    | Turn advice into weekly/monthly action plans                                |
| **File Creation**         | Create validation plans, interview questions, competitor analysis, roadmaps |

## Sample Files Created

- `startup-validation-plan.md`
- `customer-interview-questions.md`
- `competitor-analysis.md`
- `30-day-founder-plan.md`
- `mvp-roadmap.md`

## Demo Flow

1. _"I have a startup idea, but how do I know if people actually want to use it?"_
2. _"Challenge my startup idea and tell me the 3 biggest reasons it could fail."_
3. _"I'm a technical founder. Should I prioritize marketing? Create a plan for what I should focus on next month."_
4. _"Create that plan as a file and save it."_

**Demonstrates:** Conversation → Critical reasoning → Personalized advice → Long-term planning → File creation

## Demo Video Title

> _"I Gave It My Startup Idea and Asked a Simple Question: How Do I Know If People Actually Want This?"_

## Key Message

Persona AI isn't there to agree with your startup idea. The Startup Thinker exists to **challenge your assumptions and help you figure out what to do next**.

---

# 🌍 Agent 2: Study Abroad Navigator (⚠️ ARCHIVED)

> _This agent is parked. The spec is preserved for future reference._

## Purpose

Help students navigate from **"I want to study abroad"** to **"I know exactly where I'm going, why, and what I need to do next."**

## Tagline

> From dreaming of studying abroad to your first day on campus.

## Bio

Your AI study-abroad companion, helping you navigate universities, applications, scholarships, finances, visas, and every step of your journey abroad.

## Personality

- Empathetic · Analytical · Direct · Curious · Calm

## How It Works

The agent first builds a **student profile**:

- Current degree · University · CGPA · Graduation year
- Desired field · Career goals · Preferred countries
- Budget · Financial situation
- Test status (IELTS/TOEFL/GRE)
- Research experience · Work/internship experience · Projects
- Preferred intake

Then it creates a **personalized strategy**.

## 22 Core Skills

| #   | Skill                             | Focus                                                       |
| --- | --------------------------------- | ----------------------------------------------------------- |
| 01  | Student Profile Analysis          | Build comprehensive student profile                         |
| 02  | Country Selection                 | Match student to best-fit countries                         |
| 03  | University Shortlisting           | Shortlist universities based on profile                     |
| 04  | Admission Eligibility             | Check eligibility for programs                              |
| 05  | Application Roadmap               | Timeline and milestones                                     |
| 06  | IELTS/TOEFL/GRE Guidance          | Test prep strategy                                          |
| 07  | SOP Writing Guide                 | Statement of Purpose guidance                               |
| 08  | LOR Guidance                      | Letter of Recommendation strategy                           |
| 09  | CV/Resume for Admissions          | Academic CV creation                                        |
| 10  | Scholarship Finder                | Find matching scholarships                                  |
| 11  | Tuition & Cost Planning           | Budget and cost analysis                                    |
| 12  | Education Loan Guidance           | Loan options and process                                    |
| 13  | Visa Guidance                     | Country-specific visa processes                             |
| 14  | Application Deadlines             | Deadline tracking                                           |
| 15  | Document Checklist                | Complete document management                                |
| 16  | Pre-Departure Guide               | Preparation before leaving                                  |
| 17  | Accommodation Guide               | Housing options                                             |
| 18  | Student Life Abroad               | Cultural adaptation                                         |
| 19  | Internship & Career Guide         | Career planning abroad                                      |
| 20  | Post-Study Work Options           | Work permits, PR pathways                                   |
| 21  | Official Sources & Web Research   | Current research capability                                 |
| 22  | Personalized Study Abroad Roadmap | **Orchestrator skill** — determines which skills are needed |

## Knowledge Base

Central **Study Abroad Navigator Knowledge Base** containing:

- Student profile analysis
- Countries & universities
- Admission eligibility
- IELTS/TOEFL/GRE information
- SOPs, LORs, Academic CVs
- Scholarships, tuition, living costs
- Education loans
- Visa processes
- Application deadlines
- Documents, accommodation, pre-departure
- Student life, internships, careers
- Post-study work

**Note:** For frequently changing data (visa policies, deadlines, tuition, scholarships), the agent uses **current web research** and prioritizes **official sources**.

## Demo Flow

1. _"I'm a 3rd-year engineering student from India and I want to do my Master's abroad after graduation, but I have no idea where to start. Can you help me figure out which countries might be best for me?"_
2. _"Based on everything I've told you, shortlist the best countries and universities for my profile, explain why they fit me, and tell me what I should do next."_
3. _"Now create my complete study-abroad roadmap from today until I leave for university. Research anything that needs current information, break it into monthly actions, include exams, documents, applications, scholarships, finances and visa preparation, and save the final roadmap as a file for me."_

**Demonstrates:** User Context + Knowledge Base + Research → Deep Agent Plan → Search Knowledge → Research Current Info → Delegate tasks → Combine results → Create roadmap → Save file

## Sample Output

- `my-study-abroad-roadmap.md`

## Demo Video Title

> _"I Told an AI I Want to Study Abroad and Asked a Simple Question: Where Do I Even Start?"_

## Key Message

The Study Abroad Navigator doesn't just answer one study-abroad question. It can guide a student through an **entire journey**.

---

# 💼 Agent 3: The Career Launchpad (✅ ACTIVE)

> _🚀 This is the reference/dogfooding agent persona.hasanraiyan.me built using its own agent-building system._

## Purpose

Help someone go from **"I want this career"** to **"I know what's missing, what I need to do, and how to become job-ready."**

## Tagline

> From "I need a job" to "I'm ready for the interview."

## Bio

An AI career companion that understands your skills, experience, and goals, then helps you choose the right career path, identify skill gaps, build your portfolio, improve your resume, prepare for interviews, discover opportunities, and create a personalized job-search strategy.

## How It Works

The agent first creates a **candidate profile**:

- **Current Skills** — Python, JavaScript, AI/ML, etc.
- **Experience** — Internships and work experience
- **Projects** — What has actually been built
- **GitHub** — Evidence of technical ability
- **Resume** — Does it communicate abilities effectively?
- **Career Goal** — What exact role does the user want?

Then the Deep Agent:

1. Researches current market requirements
2. **Compares** current profile vs. market requirements
3. **Generates gap analysis**
4. **Creates personalized roadmap**

## 42 Core Skills

| #   | Skill                         | #   | Skill                        |
| --- | ----------------------------- | --- | ---------------------------- |
| 01  | Candidate Profile Analysis    | 22  | Application Personalization  |
| 02  | Career Goal Discovery         | 23  | Application Tracking         |
| 03  | Career Path Recommendation    | 24  | Recruiter Outreach           |
| 04  | Skill Gap Analysis            | 25  | Networking Strategy          |
| 05  | Industry & Role Research      | 26  | Referral Strategy            |
| 06  | Job Market Analysis           | 27  | Cold Email Writing           |
| 07  | Job Description Analysis      | 28  | Technical Interview Prep     |
| 08  | Resume Analysis               | 29  | Coding Interview Prep        |
| 09  | Resume Writing                | 30  | System Design Interview Prep |
| 10  | ATS Resume Optimization       | 31  | Behavioral Interview Prep    |
| 11  | Cover Letter Writing          | 32  | HR Interview Prep            |
| 12  | LinkedIn Profile Optimization | 33  | Mock Interview               |
| 13  | GitHub Profile Review         | 34  | Interview Answer Feedback    |
| 14  | Portfolio Review              | 35  | Salary Research              |
| 15  | Project Recommendation        | 36  | Salary Negotiation           |
| 16  | Project Building Roadmap      | 37  | Offer Comparison             |
| 17  | Technical Skill Roadmap       | 38  | Rejection Analysis           |
| 18  | Soft Skills Development       | 39  | Career Progress Tracking     |
| 19  | Job Search Strategy           | 40  | Personalized Career Roadmap  |
| 20  | Job Opportunity Research      | 41  | Current Web Research         |
| 21  | Job Fit Scoring               | 42  | **Career Orchestrator**      |

## Demo Flow

1. _"I'm a 3rd-year engineering student and I want to become an AI engineer after graduation. I know Python and full-stack development, but I'm not sure if I'm actually job-ready. Can you evaluate where I stand?"_
2. _"Based on my profile, research what companies currently expect from entry-level AI engineers and show me exactly where my biggest skill gaps are."_
3. _"Now create a complete 6-month career plan for me. Include what I should learn, projects I should build, how to improve my resume and GitHub, when to start applying, and how to prepare for interviews. Save everything as a file I can follow."_

**Demonstrates:** User Profile + Knowledge Base + Current Job Market Research → Skill Gap Analysis → Personalized Roadmap → File Creation

## Sample Output

- `my-ai-engineer-career-roadmap.md`

---

# System Architecture (Common)

```
                    PERSONA AI
                        │
              User chooses Career Launchpad
                        │
                        ▼
                    Skills
                   (42 skills)
                        │
                        ▼
                  Knowledge
                     Base
                        │
                        ▼
                   Deep Agent
                        │
          ┌─────────────┼─────────────┐
          │             │             │
        Tools       Sub-agents    Web Research
          │             │             │
          └─────────────┼─────────────┘
                        │
                        ▼
                  Deep Reasoning
                        │
                        ▼
                    File System
                        │
                        ▼
               Persistent Artifacts
```

> _The architecture is identical for archived agents (🚀 Startup Thinker, 🌍 Study Abroad Navigator) —
> they simply have different skills, knowledge bases, and orchestrator logic._

---

# Core Product Story

### The Core Promise

| Agent                               | Problem                                                | Promise                                                                    |
| ----------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| 💼 **Career Launchpad** (✅ ACTIVE) | _"I have a career goal. Help me become ready for it."_ | Skill gap analysis, resume prep, interview readiness, personalized roadmap |

> _The 🚀 Startup Thinker and 🌍 Study Abroad Navigator (⚠️ ARCHIVED) followed the same pattern — one agent, one journey, one promise — but are parked for future consideration._

### The Differentiator

> You don't come to Persona AI because you need **one answer**. You come because you have a **journey**.

The Career Launchpad stays specialized in that journey — using skills, knowledge, context, research, tools, sub-agents, deep reasoning, and files to help a graduate go from uncertain to hired.

**The career journey is the interface. The agentic system underneath is the real value.**
