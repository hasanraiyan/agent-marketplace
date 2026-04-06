## Project Overview

This is an AI agent platform where users onboard, then create and manage their own agents. Each agent has its own behavior (system instructions) and can be shared so others can use it.

---

## MVP Scope

1. **Auth & Onboarding**
   - Email/password authentication.
   - Simple user profile (at least name + email).

2. **Agents**
   - A signed-in user can create **only one agent** in the MVP.
   - That single agent has at minimum:
     - Name (e.g. "raiyan").
     - Description.
     - System instructions (prompt defining behavior).
   - Agents are executable chat-style: user sends a message, agent responds.
   - UX follows a "builder" pattern similar to GPT builder:
     - Left: Create/Configure view with fields (name, description, instructions).
     - Right: Live preview chat panel talking to that agent.

3. **Models & API Keys**
   - For MVP, **the platform does not provide shared model keys**.
   - Whoever creates an agent is responsible for configuring and owning their own model/API keys.
   - Each **user** manages their own provider configuration in a dedicated settings area (e.g. `/settings/providers`).
   - Providers are configured via cards + modal:
     - Company / model name.
     - Base URL.
     - API key.
   - Each agent chooses exactly one of the user's configured providers for now.

4. **Runtime / Orchestration (Future-Aligned)**
   - Long-term, agents will run on LangGraph + Deep Agents.
   - MVP runtime can start simple (single model call with system instructions), but the design should allow plugging in LangGraph/Deep Agents later.

5. **Sharing**
   - An agent owner can share an agent so others can use it.
   - Shared usage (for MVP): consumers can call the agent but cannot edit its configuration.
   - Shared agents are accessed via a public/unlisted URL (e.g. `/a/:agentId`) that shows only the chat view, not the configuration.

6. **Out of Scope for MVP (Deferred)**
   - Billing, credits, and monetization.
   - Teams/workspaces and collaborative editing.
   - Complex skills/MCP integrations (planned for later).
   - Multi-provider routing or advanced evaluation.
