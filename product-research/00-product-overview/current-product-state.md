# Current Product State: persona.hasanraiyan.me

> **Source:** Codebase analysis (July 2026)
> **Status:** FACT — derived from inspecting the live codebase

## What is persona.hasanraiyan.me?

persona.hasanraiyan.me is an **agent marketplace + agent creation/runtime platform**. It provides two intentionally separate experiences sharing a unified backend, authentication, API, and agent runtime (AG-UI):

### Persona — Consumer Experience (`/dashboard`)

For people who want to **discover, understand, and use** agents. The consumer experience feels simple — browse agents, view their profiles, and have conversations.

**Consumer flow:** Discover → Agent Profile → Conversation

### Agent Studio — Creator Experience (`/studio`)

For people who want to **build, configure, test, and publish** agents. Agent Studio provides all the power needed to create sophisticated agents with skills, knowledge bases, MCP/connectors, memory, and provider/model configuration.

**Creator flow:** Build → Configure → Resources → Test → Publish

Both experiences sit on top of the same platform/runtime. Agent Studio is **not** a separate product — it is the creator-facing side of persona.hasanraiyan.me.

### 💼 Career Launchpad

Career Launchpad is a **reference/dogfooding agent** built _on_ persona.hasanraiyan.me using its agent-building system (skills, knowledge, memory, MCP, etc.). Its purpose is to validate that Persona can successfully build and operate a sophisticated real-world agent, exposing any weaknesses in the creator tools.

**Career Launchpad does NOT define the product.** Persona is a platform that can host many such agents.

## Current Architecture

| Layer              | Technology                                    | Status      |
| ------------------ | --------------------------------------------- | ----------- |
| Backend API        | Node.js / Express 5 / MongoDB (Mongoose 9)    | ✅ Complete |
| AI Stack           | LangChain + LangGraph + Deep Agents           | ✅ Complete |
| Auth               | Clerk (webhooks, JWT)                         | ✅ Complete |
| Web Frontend       | Next.js (App Router) / shadcn / CopilotKit v2 | ✅ Complete |
| Mobile             | Flutter (Riverpod / GoRouter)                 | 🟡 Partial  |
| Deep Agent Package | Standalone LangGraph agent                    | ✅ Complete |

## Frontend Route Architecture

### Persona (Consumer) Routes — `/dashboard`

| Route                        | Purpose                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| `/dashboard`                 | Discover agents — search, browse by category, featured/trending agents |
| `/dashboard/agents`          | My Agents — list of owned agents (see Marketplace Limitation below)    |
| `/dashboard/agents/[id]`     | Agent profile — consumer-facing detail page with capabilities summary  |
| `/dashboard/agents/[id]/run` | Conversation — AG-UI streaming chat with the agent                     |
| `/dashboard/settings`        | User settings (profile, appearance, danger zone)                       |
| `/dashboard/profile`         | User profile                                                           |

### Agent Studio (Creator) Routes — `/studio`

| Route                       | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `/studio`                   | Studio home — stats, recent agents, resources overview           |
| `/studio/agents`            | Agent management — list, create, delete                          |
| `/studio/agents/new`        | Create new agent                                                 |
| `/studio/agents/[id]`       | Agent detail (configuration)                                     |
| `/studio/agents/[id]/build` | Agent builder — system prompt, model, provider, skills, etc.     |
| `/studio/agents/[id]/test`  | Agent testing — test conversations in context                    |
| `/studio/skills`            | Skill management — create, edit, browse skills                   |
| `/studio/skills/public`     | Public skill marketplace                                         |
| `/studio/knowledge`         | Knowledge base management — upload documents, manage RAG sources |
| `/studio/connectors`        | MCP connector management — add, configure, connect MCP servers   |
| `/studio/memory`            | Persistent memory management                                     |
| `/studio/providers`         | LLM provider management — API keys, model configuration          |

### Legacy Redirects (Dashboard → Studio)

Several legacy creator routes under `/dashboard` now redirect to Studio:

| Legacy Route                                | Redirects To                |
| ------------------------------------------- | --------------------------- | --------- | ---------- | -------- |
| `/dashboard/agents/create`                  | `/studio/agents/new`        |
| `/dashboard/agents/builder`                 | `/studio/agents/new`        |
| `/dashboard/agents/[id]/builder`            | `/studio/agents/[id]/build` |
| `/dashboard/agents/[id]/edit`               | `/studio/agents/[id]/build` |
| `/dashboard/connectors/[[...slug]]`         | `/studio/{skills            | knowledge | connectors | memory}` |
| `/dashboard/skills/[[...slug]]`             | `/studio/skills/...`        |
| `/dashboard/settings/providers/[[...slug]]` | `/studio/providers/...`     |

## Features that Exist

### Core Agent Platform

- **Agent marketplace** — browse/search public agents with category filters
- **Agent profiles** — consumer-facing detail pages with plain-language capability summaries
- **Agent chat** — AG-UI protocol streaming chat with tool calls and reasoning
- **Sub-agents** — agents can delegate tasks to sub-agents, shown in expandable activity dialogs
- **Agent builder** — create/edit agents with name, description, system prompt, model, provider in Studio
- **Agent testing** — test agents within Studio before publishing
- **Agent onboarding** — persona onboarding wizard

### Connectors (4 pillars)

1. **Skills** — Custom SKILL.md instruction files loaded into agent context; public marketplace for sharing
2. **MCP Servers** — Connect to MCP protocol servers with auth (OAuth, API key); tools/resources discovery
3. **Knowledge Bases** — RAG system: upload documents (PDF, TXT, MD, JSON, CSV), chunked, embedded, and searchable via vector search
4. **AI Memory** — Persistent key-value memory per user and per agent

### Integrations

- **LLM Providers** — OpenAI, Anthropic, Google, or custom providers with API key management
- **Clerk Auth** — sign-in, sign-up, user sync, webhooks
- **File uploads** — for agent avatars, knowledge documents, skill snippets
- **Encryption** — AES-256-GCM field-level encryption with key rotation

### UI Features

- Responsive card grids with gradient icon tiles
- Client-side search with empty/no-results states
- Toast notifications for CRUD operations
- Theme support (light/dark)
- Tool call trace viewer, diff view, file view, search results
- Human-in-the-loop approval
- Sub-agent activity dialogs
- Mobile bottom tab navigation

## Known Technical Gaps

- Flutter app missing: unified connectors hub, public skills marketplace, memory feature (needs migration from old KV API to file-based API), skill/MCP detail pages, OAuth flows, knowledge file upload
- AI memory uses old KV API in some areas
- CopilotKit pinned to v1.56.3 preview — migration needed for future versions

## Known Product Gaps

### Marketplace Architecture

Persona does **not** yet have a proper Add/Install relationship for marketplace agents.

- **"My Agents" currently shows agents the user OWNS**, not agents they have installed from the marketplace.
- There is no installation schema, agent instance model, subscription system, or fork mechanism.
- Monetization, ratings, reviews infrastructure, and analytics are **not implemented**.
- The agent detail page shows review UI with placeholder "no reviews yet" state, but actual review submission is not wired.

This is a **known product gap** that should be explicitly tracked.

## Career Launchpad — Reference/Dogfooding Agent

Career Launchpad is a sophisticated agent built on persona.hasanraiyan.me using:

- 42 specialized skills
- Knowledge bases
- Memory persistence
- Web research (Tavily)
- File creation capabilities

Its purpose is to **validate** the Persona agent-building system. Issues found while building Career Launchpad drive improvements to Agent Studio, skills system, knowledge system, memory, connectors, and the agent runtime.

See `agent-specifications.md` in `product-research/06-features/` for the full specification.

## Who Is Currently Using This?

**UNKNOWN** — No analytics data, user research, or adoption numbers were found in the codebase. We do not know who the current users are, what they use the platform for, or what drives their satisfaction/churn.
