# Product Research — Persona.ai

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
PERSONA (01-user-research/)
   ↓
PROBLEM (02-problems/)
   ↓
EVIDENCE (03-market-research/)
   ↓
DESIRED OUTCOME (04-outcomes/)
   ↓
SOLUTION HYPOTHESIS (05-solutions/)
   ↓
FEATURE SPECIFICATION (06-features/)
   ↓
DESIGN (07-design/)
   ↓
REQUIREMENTS (08-requirements/)
   ↓
VALIDATION (09-validation/)
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
├── 01-user-research/         Personas, journeys, raw notes
├── 02-problems/              Problem inventory & validation
├── 03-market-research/       Competition, solutions, findings
├── 04-outcomes/              Desired user outcomes
├── 05-solutions/             Solution hypotheses & priorities
├── 06-features/              Feature inventory & specifications
├── 07-design/                User flows & design requirements
├── 08-requirements/          Product, functional, non-functional reqs
└── 09-validation/            Acceptance criteria & persona validation
```
