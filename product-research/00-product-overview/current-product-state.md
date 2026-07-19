# Current Product State: Persona.ai

> **Source:** Codebase analysis (July 2026)
> **Status:** FACT — derived from inspecting the live codebase

## What is Persona.ai?

Persona.ai is an **intelligent agent orchestration platform**. Users can create, configure, and run AI agents with custom instructions, tools, and knowledge sources. Agents can be chained (sub-agents), connected to external tools (MCP servers), given custom skills (SKILL.md files), and equipped with knowledge bases (RAG) and persistent memory.

## Current Architecture

| Layer | Technology | Status |
|-------|-----------|--------|
| Backend API | Node.js / Express 5 / MongoDB (Mongoose 9) | ✅ Complete |
| AI Stack | LangChain + LangGraph + Deep Agents | ✅ Complete |
| Auth | Clerk (webhooks, JWT) | ✅ Complete |
| Web Frontend | Next.js (App Router) / shadcn / CopilotKit v2 | ✅ Complete |
| Mobile | Flutter (Riverpod / GoRouter) | 🟡 Partial |
| Deep Agent Package | Standalone LangGraph agent | ✅ Complete |

## Features that Exist

### Core Agent Platform
- **Multi-agent support** — users can create multiple agents, one designated as "Main Agent"
- **Agent builder** — create/edit agents with name, description, system prompt, model, provider
- **Agent marketplace** — browse/search public agents
- **Agent chat** — AG-UI protocol streaming chat with tool calls and reasoning
- **Sub-agents** — agents can delegate tasks to sub-agents, shown in expandable activity dialogs
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

## What Exists in Documentation — but NOT User Research

The existing docs are all **technical/implementation-focused**:

| Document | Purpose |
|----------|---------|
| `goal.md` | Dev roadmap for multi-agent, chat UI, sub-agent routing |
| `research.md` | Competitor KB research (ChatGPT, Claude, Gemini) |
| `knowledge_base_plan.md` | Technical spec for KB feature |
| `PENDING_TASKS.md` | Tracked tech debt |
| `persona/PLAN.md` | Flutter screen plan/routes |
| `persona/connectors_prompt.md` | Engineering brief for Flutter connectors |

**Missing:** User personas, problem inventory, market research (general), desired outcomes, solution hypotheses, feature traceability, design requirements, validation criteria.

## Known Technical Gaps

- Flutter app missing: unified connectors hub, public skills marketplace, memory feature (needs migration from old KV API to file-based API), skill/MCP detail pages, OAuth flows, knowledge file upload
- AI memory uses old KV API in some areas
- CopilotKit pinned to v1.56.3 preview — migration needed for future versions

## Who Is Currently Using This?

**UNKNOWN** — No analytics data, user research, or adoption numbers were found in the codebase. We do not know who the current users are, what they use the platform for, or what drives their satisfaction/churn.
