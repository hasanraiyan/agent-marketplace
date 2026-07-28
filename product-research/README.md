# Product Research — Persona.ai

> **🔄 Product Architecture (July 2026)**
> Persona.ai is an **agent marketplace + agent creation platform** with two intentionally separate experiences:
>
> - **Persona** (consumer) — Discover, use, and have conversations with agents
> - **Agent Studio** (creator) — Build, configure, test, and publish agents
>
> **💼 Career Launchpad** is a **reference/dogfooding agent** — built _on_ Persona using its agent-building system.
> It is NOT the product itself. Its purpose is to test Persona's agent-building capabilities and serve as a proof point.
> Earlier agents (🚀 Startup Thinker, 🌍 Study Abroad Navigator) are preserved as historical research.
> Full product research spans the platform; Career Launchpad specs provide the dogfooding validation.

This directory is the **living source of truth** for product decisions in the Persona.ai platform.

## Core Principle

We are not building a generic product for everyone.

Every feature we design, build, and test must be traceable back to a **real user problem** grounded in research, evidence, or explicit hypotheses.

## Process

```
Research → Understand User → Define Persona → Identify Problems
→ Research Problems → Define Desired Outcomes → Explore Solutions
→ Define Features → Design → Develop → Test Against Persona → Iterate
```

## Document Chain (Traceability)

Every feature in this system must be traceable through this chain:

```
PERSONA → Jordan Williams (career-launchpad-backstory.md)
   ↓
PROBLEM → Job readiness (CL-P1, CL-P2, CL-P3, CL-P4)
   ↓
EVIDENCE → Market research, competitor analysis
   ↓
DESIRED OUTCOME → Clear direction, honest feedback, interview confidence
   ↓
SOLUTION HYPOTHESIS → Career readiness assessment, skill gap analysis, interview simulation
   ↓
FEATURE SPECIFICATION → Career Launchpad features
   ↓
DESIGN → User flows & design requirements
   ↓
REQUIREMENTS → Product, functional, non-functional reqs
   ↓
VALIDATION → Acceptance criteria & persona validation
```

If a feature cannot be traced back to a documented problem and persona, it is flagged as speculative and placed in the **parking lot**.

## Status Legend

Throughout these documents, we distinguish:

| Label          | Meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| **FACT**       | Something confirmed by the user or team                           |
| **EVIDENCE**   | Supported by research, interviews, analytics, or external sources |
| **ASSUMPTION** | Currently believed but not validated                              |
| **HYPOTHESIS** | Intended to be tested                                             |
| **UNKNOWN**    | Still needs to be discovered                                      |

## Directory Structure

```
product-research/
├── 00-product-overview/      Current product state summary
├── 01-user-research/         User backstory, persona, journey (Career Launchpad focused)
├── 02-problems/              Problem inventory & validation (Career Launchpad problems are P0)
├── 03-market-research/       Competition, solutions, findings
├── 04-outcomes/              Desired user outcomes
├── 05-solutions/             Solution hypotheses & priorities
├── 06-features/              Feature inventory & specifications
├── 07-design/                User flows & design requirements
├── 08-requirements/          Product, functional, non-functional reqs
└── 09-validation/            Acceptance criteria & persona validation
```

## Current Focus: Persona.ai Platform + Career Launchpad (Dogfooding)

| Element                 | Detail                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Platform**            | Persona.ai — Agent Marketplace + Agent Studio                                                                             |
| **Consumer Experience** | Discover agents → Agent Profile → Conversation                                                                            |
| **Creator Experience**  | Agent Studio: Build → Configure → Resources → Test → Publish                                                              |
| **Reference Agent**     | 💼 Career Launchpad — built on Persona to validate the agent-building system                                              |
| **Target User**         | Jordan Williams — recent graduate, CS degree, struggling to break into AI engineering                                     |
| **Core Problem**        | No honest feedback on job readiness. Generic advice. Spray-and-pray applications. Invisible to recruiters.                |
| **Solution**            | Personalized skill gap analysis + resume optimization + mock interviews + career roadmap — all driven by real market data |
| **Key Differentiator**  | Specific, honest, data-backed feedback. Comparison to real job market requirements. Prioritized action plan.              |

> The other two agents (🚀 Startup Thinker, 🌍 Study Abroad Navigator) are **parked** as historical research.
> They are preserved for reference — all active development is on the Persona platform and the Career Launchpad reference agent.
