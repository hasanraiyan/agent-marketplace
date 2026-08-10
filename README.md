# persona.hasanraiyan.me

**Agent marketplace + agent creation/runtime platform.**

persona.hasanraiyan.me provides three intentionally separate experiences sharing a unified backend, authentication, API, and agent runtime (AG-UI):

- **Persona** (Consumer) — `/dashboard` — Discover, use, and have conversations with agents
- **Agent Studio** (Creator) — `/studio` — Build, configure, test, and publish agents
- **Developer Studio** (Developer) — `/developer` — Create your own Projects on top of Persona's agent infrastructure: manage members, API credentials, agents, skills, knowledge bases, connectors, providers, and stores, then plug them into your own platform

---

## Developer Studio

**Developer Studio** (`/developer`) is where you create **Projects** and build your own platform on top of Persona's agent infrastructure. Each Project is an independent workspace with its own Admins, API credentials, and resources — so you can consume Persona's agents from your own app under your own identity.

### Projects

- A Project is an **external consumer** of Persona's agent infrastructure — your own app or platform, not a Persona user session.
- Create a Project with a name and optional slug/description; you're granted an initial **Admin** membership automatically.
- **Lifecycle**: `ACTIVE` → `SUSPENDED` (credentials stop authenticating; reversible) → grace-period `DELETING` (credentials stop immediately; cancellable) → `DELETED`.
- **Members**: Admins manage the Project via their own Clerk session (v1 adds members by internal Persona User id).

### Credentials

- **Mint API credentials** (a Key ID + secret, shown once) that your Project's SDK uses to authenticate — fully separate from your own Clerk session.
- **Revoke** credentials at any time; suspending or deleting the Project blocks authentication immediately.

### Resources

Every Project owns its own resources, managed under `/developer/projects/[id]`:

| Resource    | Route prefix  | Description                                            |
| ----------- | ------------- | ------------------------------------------------------ |
| Agents      | `agents/*`    | Create, edit, and test your own agents                 |
| Skills      | `skills/*`    | Reusable capabilities your agents can use              |
| Knowledge   | `knowledge/*` | Knowledge bases (RAG) for your agents                  |
| Connectors  | `mcps/*`      | MCP server connectors (create, edit)                   |
| Providers   | `providers/*` | AI providers, with connection testing                  |
| Stores      | `stores/*`    | Named, scoped mount points agents can be assigned to   |

**Audit Logs** track each Project's lifecycle trail — credentials minted/revoked, membership changes, and suspend/restore events.

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
│   ├── src/app/            # Route pages (dashboard/, studio/, developer/, (auth)/)
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

**Career Launchpad** is a sophisticated reference agent built _on_ persona.hasanraiyan.me using its agent-building system. It validates the platform's creator tools and demonstrates what's possible. See `product-research/06-features/agent-specifications.md` for the full specification.

## Product Research

Comprehensive product research including user personas, problem inventories, market analysis, and feature specifications lives in `product-research/`.

## Architecture

- `architecture/` — Current/target architecture documents, migration plans, ADRs
- `AGENTS.md` — AI coding agent guide for the backend
- `frontend/AGENTS.md` — Next.js conventions
