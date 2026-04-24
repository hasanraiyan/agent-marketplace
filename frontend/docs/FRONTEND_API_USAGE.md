# Frontend — Backend API Usage Mapping

This document maps frontend pages/components to backend API endpoints (Express routes) the frontend calls, and lists backend routes that are not currently referenced by the frontend.

Summary:
- Frontend implements several API helper modules under `src/lib/api/*` for agents, providers, threads, skills, profile, admin and health.
- Not all helper functions are used by existing pages/components yet; many endpoints are scaffolded for future features.

Pages and API usage

- `/` (Home)
  - Components: `FeaturedAgentsSection`, `HeroSection`, etc.
  - Backend: No API calls (static demo content)

- `/agents`
  - File: `src/app/agents/page.jsx`
  - Calls: `searchAgents()` -> POST `/agents/search`
           `countAgents()` -> POST `/agents/count`
  - Notes: Agent cards link to `/agents/:id` but there is no detail page implemented yet.

- `/dashboard`
  - File: `src/app/dashboard/page.jsx`
  - Calls: none (uses local `data.json` and UI components)

- `/dashboard/agents`
  - File: `src/app/dashboard/agents/page.jsx`
  - Calls: none (TODO: intended to fetch user's agents from a user-scoped endpoint)

- `/dashboard/settings`
  - File: `src/app/dashboard/settings/page.jsx`
  - Calls: `getProviders()` -> GET `/providers`
  - Subcomponents:
    - `ProviderList` (uses `deleteProvider(id)` -> DELETE `/providers/:id`, and `testProviderConnection(id)` -> POST `/providers/:id/test`)
    - `ProviderForm` (uses `createProvider()` -> POST `/providers`, `updateProvider()` -> PUT `/providers/:id`, `testProviderCredentials(baseURL, apiKey)` -> POST `/providers/test-connection`, and `getProviderModels(id)` -> GET `/providers/:id/models`)

- Auth pages
  - `src/app/(auth)/sign-in` and `sign-up` are handled by Clerk; frontend does not call server webhooks directly.

API helper modules present but not yet used by pages

- `src/lib/api/agents.js` — functions exist: `getAgentBySlug`, `getAgent`, `createAgent`, `updateAgent`, `deleteAgent` — only `searchAgents` and `countAgents` are used.
- `src/lib/api/threads.js` — defined but no page currently calls thread APIs.
- `src/lib/api/skills.js` — defined but not referenced by pages.
- `src/lib/api/profile.js` — defined (`getProfile`, `updateProfile`) but settings/profile page not implemented.
- `src/lib/api/admin.js` — admin functions defined but no admin UI implemented.
- `src/lib/api/health.js` — defined for diagnostics; not used by UI.

Backend routes that are actively used by frontend

- POST `/agents/search` (used by `/agents` page)
- POST `/agents/count` (used by `/agents` page)
- GET `/providers` (used by settings page)
- POST `/providers` (create provider via form)
- POST `/providers/test-connection` (test credentials when adding provider)
- POST `/providers/:id/test` (provider list "Test" action)
- GET `/providers/:id/models` (fetch models for provider)
- PUT `/providers/:id` (update provider)
- DELETE `/providers/:id` (delete provider)

Backend routes present but not referenced in frontend (candidates to implement or remove)

- Agent detail and management
  - GET `/agents/:id` — defined but not fetched by any page
  - GET `/agents/slug/:slug` — not used
  - POST `/agents` — UI create endpoint not wired into dashboard create page
  - PATCH `/agents/:id` — edit page not implemented
  - DELETE `/agents/:id` — delete from dashboard not implemented (TODO exists)

- Threads/chat
  - All `/threads` endpoints (`POST /threads`, `GET /threads`, `GET /threads/:id`, streaming endpoints) are not used yet — chat UI missing

- Skills
  - `/skills/*` endpoints are not used by current pages

- Profile
  - `/profile` endpoints exist but the settings profile subpage is not implemented

- Admin
  - `/admin/users` and `/admin/users/:id` are not referenced by UI

- Health
  - `/health` and `/health/db` not used by UI (diagnostic only)

Recommendations / Next steps

- Implement agent detail page `/agents/[id]` or `/agents/[slug]` to consume `GET /agents/:id` or `GET /agents/slug/:slug`.
- Wire dashboard agent creation/edit pages to `POST /agents` and `PATCH /agents/:id`.
- Build chat UI to use `/threads` endpoints and SSE streaming endpoint.
- Add a profile settings page to call `/profile` endpoints.
- Remove or document unused API helpers if not intended for frontend.

If you want, I can:
- Create this file in the repo (done), or update it with more detail per-component.
- Generate a Postman collection for the endpoints the frontend actually uses.
- Open PR with the docs file and suggested TODOs.
