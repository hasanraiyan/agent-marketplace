# Persona.ai

**Agent marketplace + agent creation/runtime platform.**

Persona.ai provides two intentionally separate experiences sharing a unified backend, authentication, API, and agent runtime (AG-UI):

- **Persona** (Consumer) — `/dashboard` — Discover, use, and have conversations with agents
- **Agent Studio** (Creator) — `/studio` — Build, configure, test, and publish agents

---

## Repository Structure

```
persona-agent/
├── agent-backend/          # Node.js/Express 5 REST API + AI stack
│   ├── src/                # Source code (modules, config, middleware, utils)
│   ├── tests/              # Jest + Supertest test suite
│   ├── docs/               # Full documentation suite
│   └── scripts/            # CLI utilities
├── frontend/               # Next.js (App Router) web frontend
│   ├── src/app/            # Route pages (dashboard/, studio/, (auth)/)
│   ├── src/components/     # UI components
│   └── src/lib/            # API helpers and utilities
├── deep-agent/             # Standalone LangGraph Deep Agent package
├── persona/                # Flutter mobile app (partial)
├── architecture/           # Architecture documentation & ADRs
├── product-research/       # Product research & user research docs
└── AGENTS.md               # AI coding agent guide (backend-focused)
```

## Prerequisites

- Node.js 22+
- pnpm (recommended)
- MongoDB (local or Atlas)

## Quick Start

```bash
# Install all dependencies
pnpm install

# Start backend
cd agent-backend
pnpm dev

# Start frontend (in another terminal)
cd frontend
pnpm dev
```

## Backend

See `agent-backend/README.md` and `agent-backend/docs/README.md` for full documentation.

## Frontend

See `frontend/README.md` and `frontend/docs/FRONTEND_API_USAGE.md` for frontend documentation.

## Career Launchpad (Reference/Dogfooding Agent)

**Career Launchpad** is a sophisticated reference agent built _on_ Persona.ai using its agent-building system. It validates the platform's creator tools and demonstrates what's possible. See `product-research/06-features/agent-specifications.md` for the full specification.

## Product Research

Comprehensive product research including user personas, problem inventories, market analysis, and feature specifications lives in `product-research/`.

## Architecture

- `architecture/` — Current/target architecture documents, migration plans, ADRs
- `AGENTS.md` — AI coding agent guide for the backend
- `frontend/AGENTS.md` — Next.js conventions
