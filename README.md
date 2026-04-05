# Agent Marketplace

Monorepo containing the backend and frontend for the Agent Marketplace project.

## Structure
- `agent-backend/` — Node.js backend with tests and scripts
- `agent-frontend/` — Vite React frontend

## Prerequisites
- Node.js (LTS)
- pnpm (recommended)

## Setup
Install dependencies for both packages from the repository root:

```bash
pnpm install
```

## Running

- Start backend (from `agent-backend`):

```bash
cd agent-backend
pnpm start
```

- Start frontend (from `agent-frontend`):

```bash
cd agent-frontend
pnpm dev
```

## Tests (backend)

```bash
cd agent-backend
pnpm test
```

## Contributing
See `agent-backend/CONTRIBUTING.md` for backend contribution guidelines.

---
If you'd like a longer README (architecture, env vars, deployment), tell me what to include.
