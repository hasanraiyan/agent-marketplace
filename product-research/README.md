# Product Research — Persona.ai

> **⚠️ Strategic Pivot: Single-Agent Focus (July 2026)**
> Persona.ai launches with **one agent only**: the **💼 Career Launchpad**.
> All product research, problems, outcomes, and features are now centered on this single agent.
> The previous 3-agent / 6-persona model is parked. Full traceability runs through one chain:
> **Jordan Williams → Career Launchpad → Job readiness.**

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

| Label | Meaning |
|-------|---------|
| **FACT** | Something confirmed by the user or team |
| **EVIDENCE** | Supported by research, interviews, analytics, or external sources |
| **ASSUMPTION** | Currently believed but not validated |
| **HYPOTHESIS** | Intended to be tested |
| **UNKNOWN** | Still needs to be discovered |

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

## Current Focus: Career Launchpad

| Element | Detail |
|---------|--------|
| **Agent** | 💼 Career Launchpad |
| **Target User** | Jordan Williams — recent graduate, CS degree, struggling to break into AI engineering |
| **Core Problem** | No honest feedback on job readiness. Generic advice. Spray-and-pray applications. Invisible to recruiters. |
| **Solution** | Personalized skill gap analysis + resume optimization + mock interviews + career roadmap — all driven by real market data |
| **Key Differentiator** | Specific, honest, data-backed feedback. Comparison to real job market requirements. Prioritized action plan. |

> The other two agents (🚀 Startup Thinker, 🌍 Study Abroad Navigator) are **parked** for future consideration.
> They are not being removed — their research is preserved for reference — but all development focus is on the Career Launchpad.
