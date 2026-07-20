# 09 - Refactoring Progress & Actionable Tasks

This document contains a highly granular, step-by-step checklist for the refactoring of the Persona.ai backend. Any autonomous coding agent can pick up a single pending step, execute the code moves, verify them against tests, and mark the items completed.

---

## Task Progress Summary

- **Phase 1 to 10: Research & Planning**: [x] Completed
- **Phase 11: Incremental Refactoring Implementation**:
  - **Step 1: Setup & Auth Service**: [x] Completed
  - **Step 2: Health Module**: [ ] Pending
  - **Step 3: Upload Module**: [ ] Pending
  - **Step 4: Clerk Webhook**: [ ] Pending
  - **Step 5: Skills Module**: [ ] Pending
  - **Step 6: Providers Module**: [ ] Pending
  - **Step 7: Users & Profile Module**: [ ] Pending
  - **Step 8: Threads & Checkpoints**: [ ] Pending
  - **Step 9: MCP Module**: [ ] Pending
  - **Step 10: Agents & Memory Module**: [ ] Pending
  - **Step 11: AGUI SSE Chat Stream**: [ ] Pending
  - **Step 12: Knowledge Module**: [ ] Pending
  - **Step 13: Final Cleanup & Server Validation**: [ ] Pending

---

## Detailed Task Checklists

### [x] Step 1: Create Module Folder Structures & Auth Sync Service
* **Objective**: Initialize the modular folder structure and consolidate duplicate Clerk syncing logic.
* **Tasks**:
  - [x] Create folder structures in `src/modules/`: `auth`, `users`, `health`, `upload`, `webhooks`, `skills`, `providers`, `threads`, `mcps`, `agents`, `agui`, `knowledge`.
  - [x] Create `src/modules/auth/auth.service.js` containing user retrieval and auto-sync logic.
  - [x] Move `src/middlewares/auth.middleware.js` to `src/modules/auth/auth.middleware.js` and refactor it to call `authService.syncUser`.
  - [x] Move `src/middlewares/optionalAuthMiddleware.js` to `src/modules/auth/optional-auth.middleware.js` and refactor it to call `authService.syncUser`.
  - [x] Move `src/middlewares/admin.middleware.js` to `src/modules/users/admin.middleware.js`.
  - [x] Update all import paths to these middlewares across all existing files in `src/`.
  - [x] Run `pnpm test` to verify auth checks still work perfectly.

### [ ] Step 2: Health Module Refactor
* **Objective**: Migrate the health checks to `src/modules/health/`.
* **Tasks**:
  - [ ] Move `src/routes/health.js` to `src/modules/health/health.routes.js`.
  - [ ] Move `src/controllers/healthController.js` to `src/modules/health/health.controller.js`.
  - [ ] Move `src/services/healthService.js` to `src/modules/health/health.service.js`.
  - [ ] Move `src/repositories/healthRepository.js` to `src/modules/health/health.repository.js`.
  - [ ] Update imports within these moved files.
  - [ ] Update `src/index.js` to mount the new route file path.
  - [ ] Verify `/api/v1/health` and `/api/v1/health/db` function correctly.
  - [ ] Run `pnpm test` to ensure zero regressions.

### [ ] Step 3: Upload Module Refactor
* **Objective**: Colocate upload routing under `src/modules/upload/`.
* **Tasks**:
  - [ ] Move `src/routes/upload.routes.js` to `src/modules/upload/upload.routes.js`.
  - [ ] Fix relative imports inside `upload.routes.js`.
  - [ ] Update route mount in `src/index.js`.
  - [ ] Verify image uploading via `/api/v1/upload/avatar` still works.
  - [ ] Run `pnpm test`.

### [ ] Step 4: Clerk Webhook Module Refactor
* **Objective**: Decouple Clerk webhook route from business/data-access logic.
* **Tasks**:
  - [ ] Move `src/routes/webhook.routes.js` to `src/modules/webhooks/webhook.routes.js`.
  - [ ] Create `src/modules/webhooks/webhook.controller.js` to process SVIX events.
  - [ ] Create `src/modules/webhooks/webhook.service.js` to encapsulate creating/updating/deleting synchronized users.
  - [ ] Replace direct `User` model queries inside the webhook handler with calls to `userRepository` from `webhook.service.js`.
  - [ ] Update route mount in `src/index.js`.
  - [ ] Run `pnpm test`.

### [ ] Step 5: Skills Module Refactor
* **Objective**: Move skills to `src/modules/skills/` and resolve cross-domain database coupling.
* **Tasks**:
  - [ ] Move `src/routes/skill.routes.js` to `src/modules/skills/skill.routes.js`.
  - [ ] Move `src/controllers/skill.controller.js` to `src/modules/skills/skill.controller.js`.
  - [ ] Move `src/services/skill.service.js` to `src/modules/skills/skill.service.js`.
  - [ ] Move `src/repositories/skillRepository.js` to `src/modules/skills/skill.repository.js`.
  - [ ] Move `src/models/Skill.js` to `src/modules/skills/skill.model.js`.
  - [ ] Move `src/validators/skill.validator.js` to `src/modules/skills/skill.validator.js`.
  - [ ] Add `removeSkillFromAgents` and `findAgentsUsingSkill` to `agentRepository`.
  - [ ] In `skill.service.js`, remove the direct import of `Agent` model and call the new repository methods.
  - [ ] Update all relative imports inside these files.
  - [ ] Update `src/index.js` route mount.
  - [ ] Run `pnpm test`.

### [ ] Step 6: Providers Module Refactor
* **Objective**: Move provider files to `src/modules/providers/` and resolve agent model coupling.
* **Tasks**:
  - [ ] Move `src/routes/provider.routes.js` to `src/modules/providers/provider.routes.js`.
  - [ ] Move `src/controllers/provider.controller.js` to `src/modules/providers/provider.controller.js`.
  - [ ] Move `src/services/provider.service.js` to `src/modules/providers/provider.service.js`.
  - [ ] Move `src/repositories/providerRepository.js` to `src/modules/providers/provider.repository.js`.
  - [ ] Move `src/models/Provider.js` to `src/modules/providers/provider.model.js`.
  - [ ] Move `src/validators/provider.validator.js` to `src/modules/providers/provider.validator.js`.
  - [ ] Add `findByProviderId` and `countByProviderId` to `agentRepository`.
  - [ ] Remove `Agent` model imports from `provider.service.js` and use `agentRepository` methods.
  - [ ] Update imports and the mount path in `src/index.js`.
  - [ ] Run `pnpm test`.

### [ ] Step 7: Users & Profile Module Refactor
* **Objective**: Move user/profile modules to `src/modules/users/`, clean schema definitions, and extract service.
* **Tasks**:
  - [ ] Move `src/routes/profile.routes.js` and `admin.routes.js` to `src/modules/users/`.
  - [ ] Move `src/controllers/profile.controller.js` and `admin.controller.js` to `src/modules/users/`.
  - [ ] Move `src/repositories/userRepository.js` to `src/modules/users/user.repository.js`.
  - [ ] Move `src/models/User.js` to `src/modules/users/user.model.js`.
  - [ ] Move `src/validators/profile.validator.js` to `src/modules/users/profile.validator.js`.
  - [ ] Delete the duplicate definition of the `username` property in `user.model.js`.
  - [ ] Create `src/modules/users/user.service.js`.
  - [ ] Move the account deletion logic from `profile.controller.js` to `user.service.js`. Call child domains' repositories (e.g. `agentRepository.deleteManyByOwner`) rather than direct models.
  - [ ] Clean up controllers so they only talk to repositories and services.
  - [ ] Update route mounts in `src/index.js`.
  - [ ] Run `pnpm test`.

### [ ] Step 8: Threads & Checkpoints Module Refactor
* **Objective**: Move thread/checkpoint logic to `src/modules/threads/`.
* **Tasks**:
  - [ ] Move `src/routes/thread.routes.js` to `src/modules/threads/thread.routes.js`.
  - [ ] Move `src/controllers/thread.controller.js` to `src/modules/threads/thread.controller.js`.
  - [ ] Move `src/repositories/threadRepository.js` to `src/modules/threads/thread.repository.js`.
  - [ ] Move `src/models/Conversation.js` to `src/modules/threads/conversation.model.js`.
  - [ ] Move `src/validators/thread.validator.js` to `src/modules/threads/thread.validator.js`.
  - [ ] Move `src/services/checkpoint.service.js` to `src/modules/threads/checkpoint.service.js`.
  - [ ] Fix imports, update mounts in `src/index.js`, and run `pnpm test`.

### [ ] Step 9: MCP Module Refactor
* **Objective**: Move MCP logic to `src/modules/mcps/` and decouple Agent model references.
* **Tasks**:
  - [ ] Move MCP routes, controllers, services, repositories, and models.
  - [ ] Move token services and helper scripts under `src/modules/mcps/`.
  - [ ] Replace direct `Agent` Mongoose updates in `mcp.service.js` with delegation methods in `agentRepository`.
  - [ ] Fix internal imports, update mounts in `src/index.js`, and run `pnpm test`.

### [ ] Step 10: Agents & Memory Module Refactor
* **Objective**: Move agent logic to `src/modules/agents/` and remove redundant validations.
* **Tasks**:
  - [ ] Move agent routes, controllers, services, repositories, models, and factory.
  - [ ] Move memory models and memory stores under `src/modules/agents/`.
  - [ ] Remove `createAgentSchema.parse` and `updateAgentSchema.parse` inside `agent.controller.js` controller actions.
  - [ ] Update imports, fix mounts in `src/index.js`, and run `pnpm test`.

### [ ] Step 11: AGUI SSE Chat Stream Refactor
* **Objective**: Decouple routing/concurrency constraints from the LangGraph streaming and translation loop.
* **Tasks**:
  - [ ] Move `src/routes/agui.routes.js` to `src/modules/agui/agui.routes.js`.
  - [ ] Create `src/modules/agui/agui.controller.js` and extract the HTTP/SSE streaming, concurrency handling, and abort tracking.
  - [ ] Create `src/modules/agui/agui.service.js` and extract the `runAgentAsAguiEvents` generator block.
  - [ ] Fix all helper utility imports (`aguiTranslator.js`, `RunScopeTracker.js`, `subagentTrace.js`).
  - [ ] Update mounts in `src/index.js`.
  - [ ] Run `pnpm test` and `pnpm run ai:verify`.

### [ ] Step 12: Knowledge Module Refactor
* **Objective**: Relocate knowledge files to `src/modules/knowledge/`.
* **Tasks**:
  - [ ] Move knowledge routes, controllers, services, repositories, models, and validators.
  - [ ] Fix imports, update route mounts in `src/index.js`, and run `pnpm test`.

### [ ] Step 13: Final Cleanup & Server Validation
* **Objective**: Complete final validations, ensure zero dead code, clean imports, and test.
* **Tasks**:
  - [ ] Verify that all original top-level directories (`src/routes`, `src/controllers`, `src/services`, `src/repositories`, `src/models`, `src/validators`, `src/factories`) have been deleted.
  - [ ] Run `pnpm run format` to standardise code styles.
  - [ ] Run `pnpm test` and confirm all 588 unit/integration tests pass.
  - [ ] Start the backend locally with `pnpm run dev` and ensure successful bootstrap.

---

## Change Log

### Refactoring Progress Log - 2026-07-20

#### Step 1: Setup & Auth Service
* **What was changed**:
  * Created domain directories under `src/modules/` (`auth`, `users`, etc.).
  * Created `src/modules/auth/auth.service.js` containing consolidated `AuthService.syncUser` logic for Clerk user retrieval and fallback syncing.
  * Moved `src/middlewares/auth.middleware.js` to `src/modules/auth/auth.middleware.js` and refactored it to call `AuthService.syncUser`.
  * Moved `src/middlewares/optionalAuthMiddleware.js` to `src/modules/auth/optional-auth.middleware.js` and refactored it to call `AuthService.syncUser`, resolving Finding 4.1 by removing leftover debug logger filesystem writes.
  * Moved `src/middlewares/admin.middleware.js` to `src/modules/users/admin.middleware.js`.
  * Updated route files (`admin.routes.js`, `agent.routes.js`, `agui.routes.js`, `knowledge.routes.js`, `mcp.routes.js`, `memory.routes.js`, `profile.routes.js`, `provider.routes.js`, `skill.routes.js`, `thread.routes.js`, `upload.routes.js`) to import the new middleware paths.
  * Updated test files (`tests/rateLimitIntegration.test.js`, `tests/statelessResumption.test.js`, `tests/adminMiddleware.test.js`) to mock/import middlewares from the new modular paths.
  * Deleted the original deprecated files in `src/middlewares/` (`auth.middleware.js`, `optionalAuthMiddleware.js`, `admin.middleware.js`).
* **Why it was changed**:
  * Consolidated duplicated Clerk user synchronization logic to ensure consistency between optional and strict auth behaviors and to satisfy DRY principles (Finding 3.2).
  * Enforced standard service and repository boundaries (e.g. `AuthService` queries database only through `userRepository`, keeping it decoupled from database model details).
  * Prepared the authentication and authorization layer as the foundational step of the modular transition.
* **Files affected**:
  * `src/modules/auth/auth.service.js` (created)
  * `src/modules/auth/auth.middleware.js` (created)
  * `src/modules/auth/optional-auth.middleware.js` (created)
  * `src/modules/users/admin.middleware.js` (created)
  * `src/routes/admin.routes.js`
  * `src/routes/agent.routes.js`
  * `src/routes/agui.routes.js`
  * `src/routes/knowledge.routes.js`
  * `src/routes/mcp.routes.js`
  * `src/routes/memory.routes.js`
  * `src/routes/profile.routes.js`
  * `src/routes/provider.routes.js`
  * `src/routes/skill.routes.js`
  * `src/routes/thread.routes.js`
  * `src/routes/upload.routes.js`
  * `tests/adminMiddleware.test.js`
  * `tests/rateLimitIntegration.test.js`
  * `tests/statelessResumption.test.js`
  * `src/middlewares/auth.middleware.js` (deleted)
  * `src/middlewares/optionalAuthMiddleware.js` (deleted)
  * `src/middlewares/admin.middleware.js` (deleted)
* **Verification performed**:
  * Executed Jest test suite (`pnpm test`) pre-deletion and post-deletion of original files.
* **Pass/Fail status**:
  * Pass (588/588 tests passed successfully on all runs).
* **Issues discovered**:
  * The verification script `pnpm run ai:verify` fails because the `src/ai` folder it depends on was deleted in a previous commit (`4076d3a`). It has been marked as deprecated in the migration plan.
