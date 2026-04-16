# Agent Marketplace Backend Implementation Tracker

## Phase 1 — Foundations (Models & Crypto)
- [x] Replace `crypto.js` generation with existing `src/utils/encryption.js`
- [x] Create `src/models/Provider.js` schema
- [x] Create `src/models/Agent.js` schema
- [x] Create `src/models/Conversation.js` schema
- [x] Create `src/models/Message.js` schema

## Phase 2 — Provider Features
- [x] `repositories/providerRepository.js` — `create`, `findById`, `findByUser`, `update`, `delete`
- [x] `services/provider.service.js` — `createProvider` (encrypts key), `updateProvider`, `testConnection`
- [x] `controllers/provider.controller.js` — Req/Res handlers
- [x] `routes/provider.routes.js` — 5 routes including `/test`
- [x] `validators/provider.validator.js` — Zod schemas

## Phase 3 — Agent Builder & Discovery (Standard API)
- [x] `repositories/agentRepository.js` — `create`, `findById`, `findBySlug`, `update`, `delete`, `search`, `count`
- [x] `services/agent.service.js` — Auto-slug creation, visibility enforcement, `_formatSafe()`
- [x] `controllers/agent.controller.js` — `create`, `getOne`, `getBySlug`, `update`, `remove`, `search`, `count`
- [x] `routes/agent.routes.js` — `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /search`, `POST /count`, `GET /slug/:slug`
- [x] `validators/agent.validator.js` — Zod schemas (`createAgentSchema`, `updateAgentSchema`, `searchAgentSchema`)

## Phase 4 — Chat + Runtime
- [ ] `repositories/conversationRepository.js` — `create`, `findById`, `findByUser`, `updateTitle`, `updateLastMessage`
- [ ] `repositories/messageRepository.js` — `create`, `findByConversation` (paginated)
- [ ] `services/agentRuntime.service.js` — `getOrBuildRuntime` (with MongoDBSaver checkpointer), `invalidateRuntime`
- [ ] `services/chat.service.js` — `startConversation`, `streamChat` (includes auto-titling logic)
- [ ] `controllers/chat.controller.js` — SSE controller
- [ ] `routes/chat.routes.js` — 6 routes

## Phase 5 — Wire Up
- [ ] Verify dependencies are installed (`deepagents`, `langgraph-checkpoint-mongodb`, etc.)
- [ ] Update `src/index.js` to register 3 new routers
- [ ] E2E Manual Verifications
