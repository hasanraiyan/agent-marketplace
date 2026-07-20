# 09 - Refactoring Progress & Actionable Tasks

This document contains a highly granular, step-by-step checklist for the refactoring of the Persona.ai backend. Any autonomous coding agent can pick up a single pending step, execute the code moves, verify them against tests, and mark the items completed.

---

## Task Progress Summary

- **Phase 1 to 10: Research & Planning**: [x] Completed
- **Phase 11: Incremental Refactoring Implementation**:
  - **Step 1: Setup & Auth Service**: [x] Completed
  - **Step 2: Health Module**: [x] Completed
  - **Step 3: Upload Module**: [x] Completed
  - **Step 4: Clerk Webhook**: [x] Completed
  - **Step 5: Skills Module**: [x] Completed
  - **Step 6: Providers Module**: [x] Completed
  - **Step 7: Users & Profile Module**: [x] Completed
  - **Step 8: Threads & Checkpoints**: [x] Completed
  - **Step 9: MCP Module**: [x] Completed
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

### [x] Step 2: Health Module Refactor
* **Objective**: Migrate the health checks to `src/modules/health/`.
* **Tasks**:
  - [x] Move `src/routes/health.js` to `src/modules/health/health.routes.js`.
  - [x] Move `src/controllers/healthController.js` to `src/modules/health/health.controller.js`.
  - [x] Move `src/services/healthService.js` to `src/modules/health/health.service.js`.
  - [x] Move `src/repositories/healthRepository.js` to `src/modules/health/health.repository.js`.
  - [x] Update imports within these moved files.
  - [x] Update `src/index.js` to mount the new route file path.
  - [x] Verify `/api/v1/health` and `/api/v1/health/db` function correctly.
  - [x] Run `pnpm test` to ensure zero regressions.

### [x] Step 3: Upload Module Refactor
* **Objective**: Colocate upload routing under `src/modules/upload/`.
* **Tasks**:
  - [x] Move `src/routes/upload.routes.js` to `src/modules/upload/upload.routes.js`.
  - [x] Fix relative imports inside `upload.routes.js`.
  - [x] Update route mount in `src/index.js`.
  - [x] Verify image uploading via `/api/v1/upload/avatar` still works.
  - [x] Run `pnpm test`.

### [x] Step 4: Clerk Webhook Module Refactor
* **Objective**: Decouple Clerk webhook route from business/data-access logic.
* **Tasks**:
  - [x] Move `src/routes/webhook.routes.js` to `src/modules/webhooks/webhook.routes.js`.
  - [x] Create `src/modules/webhooks/webhook.controller.js` to process SVIX events.
  - [x] Create `src/modules/webhooks/webhook.service.js` to encapsulate creating/updating/deleting synchronized users.
  - [x] Replace direct `User` model queries inside the webhook handler with calls to `userRepository` from `webhook.service.js`.
  - [x] Update route mount in `src/index.js`.
  - [x] Run `pnpm test`.

### [x] Step 5: Skills Module Refactor
* **Objective**: Move skills to `src/modules/skills/` and resolve cross-domain database coupling.
* **Tasks**:
  - [x] Move `src/routes/skill.routes.js` to `src/modules/skills/skill.routes.js`.
  - [x] Move `src/controllers/skill.controller.js` to `src/modules/skills/skill.controller.js`.
  - [x] Move `src/services/skill.service.js` to `src/modules/skills/skill.service.js`.
  - [x] Move `src/repositories/skillRepository.js` to `src/modules/skills/skill.repository.js`.
  - [x] Move `src/models/Skill.js` to `src/modules/skills/skill.model.js`.
  - [x] Move `src/validators/skill.validator.js` to `src/modules/skills/skill.validator.js`.
  - [x] Add `removeSkillFromAgents` and `findAgentsUsingSkill` to `agentRepository`.
  - [x] In `skill.service.js`, remove the direct import of `Agent` model and call the new repository methods.
  - [x] Update all relative imports inside these files.
  - [x] Update `src/index.js` route mount.
  - [x] Run `pnpm test`.

### [x] Step 6: Providers Module Refactor
* **Objective**: Move provider files to `src/modules/providers/` and resolve agent model coupling.
* **Tasks**:
  - [x] Move `src/routes/provider.routes.js` to `src/modules/providers/provider.routes.js`.
  - [x] Move `src/controllers/provider.controller.js` to `src/modules/providers/provider.controller.js`.
  - [x] Move `src/services/provider.service.js` to `src/modules/providers/provider.service.js`.
  - [x] Move `src/repositories/providerRepository.js` to `src/modules/providers/provider.repository.js`.
  - [x] Move `src/models/Provider.js` to `src/modules/providers/provider.model.js`.
  - [x] Move `src/validators/provider.validator.js` to `src/modules/providers/provider.validator.js`.
  - [x] Add `findAgentsUsingProvider` to `agentRepository`.
  - [x] Remove `Agent` model imports from `provider.service.js` and use `agentRepository` methods.
  - [x] Update imports and the mount path in `src/index.js`.
  - [x] Run `pnpm test`.

### [x] Step 7: Users & Profile Module Refactor
* **Objective**: Move user/profile modules to `src/modules/users/`, clean schema definitions, and extract service.
* **Tasks**:
  - [x] Move `src/routes/profile.routes.js` and `admin.routes.js` to `src/modules/users/`.
  - [x] Move `src/controllers/profile.controller.js` and `admin.controller.js` to `src/modules/users/`.
  - [x] Move `src/repositories/userRepository.js` to `src/modules/users/user.repository.js`.
  - [x] Move `src/models/User.js` to `src/modules/users/user.model.js`.
  - [x] Move `src/validators/profile.validator.js` to `src/modules/users/profile.validator.js`.
  - [x] Delete the duplicate definition of the `username` property in `user.model.js`.
  - [x] Create `src/modules/users/user.service.js`.
  - [x] Move the account deletion logic from `profile.controller.js` to `user.service.js`. Call child domains' repositories (e.g. `agentRepository.deleteManyByOwner`) rather than direct models.
  - [x] Clean up controllers so they only talk to repositories and services.
  - [x] Update route mounts in `src/index.js`.
  - [x] Run `pnpm test`.

### [x] Step 8: Threads & Checkpoints Module Refactor
* **Objective**: Move thread/checkpoint logic to `src/modules/threads/`.
* **Tasks**:
  - [x] Move `src/routes/thread.routes.js` to `src/modules/threads/thread.routes.js`.
  - [x] Move `src/controllers/thread.controller.js` to `src/modules/threads/thread.controller.js`.
  - [x] Move `src/repositories/threadRepository.js` to `src/modules/threads/thread.repository.js`.
  - [x] Move `src/models/Conversation.js` to `src/modules/threads/thread.model.js`.
  - [x] Move `src/validators/thread.validator.js` to `src/modules/threads/thread.validator.js`.
  - [x] Move `src/services/checkpoint.service.js` to `src/modules/threads/checkpoint.service.js`.
  - [x] Fix imports, update mounts in `src/index.js`, and run `pnpm test`.

### [x] Step 9: MCP Module Refactor
* **Objective**: Move MCP logic to `src/modules/mcp/` and decouple Agent model references.
* **Tasks**:
  - [x] Move MCP routes, controllers, services, repositories, and models.
  - [x] Move token services and helper scripts under `src/modules/mcp/`.
  - [x] Replace direct `Agent` Mongoose updates in `mcp.service.js` with delegation methods in `agentRepository`.
  - [x] Fix internal imports, update mounts in `src/index.js`, and run `pnpm test`.

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

#### Step 2: Health Module Refactor
* **What was changed**:
  * Moved health routes, controllers, services, and repositories to `src/modules/health/`.
  * Updated relative imports in the moved files to preserve logging, database, and formatter behaviors.
  * Updated `src/repositories/index.js` to point to the new modular health repository path.
  * Updated `src/index.js` to mount the new health routes path.
  * Updated import paths in `tests/healthController.test.js`, `tests/healthService.test.js`, and `tests/healthRepository.test.js` to keep test functionality intact.
  * Deleted the original deprecated health files in `src/routes/`, `src/controllers/`, `src/services/`, and `src/repositories/`.
* **Why it was changed**:
  * Transitioned technical-layered files to the feature/domain-based `src/modules/health/` directory to improve cohesion and support modular architecture goals.
* **Files affected**:
  * `src/modules/health/health.routes.js` (created)
  * `src/modules/health/health.controller.js` (created)
  * `src/modules/health/health.service.js` (created)
  * `src/modules/health/health.repository.js` (created)
  * `src/index.js`
  * `src/repositories/index.js`
  * `tests/healthController.test.js`
  * `tests/healthService.test.js`
  * `tests/healthRepository.test.js`
  * `src/routes/health.js` (deleted)
  * `src/controllers/healthController.js` (deleted)
  * `src/services/healthService.js` (deleted)
  * `src/repositories/healthRepository.js` (deleted)
* **Verification performed**:
  * Executed Jest test suite (`pnpm test`) pre-deletion and post-deletion of original files.
* **Pass/Fail status**:
  * Pass (588/588 tests passed successfully on all runs).
* **Issues discovered**:
  * None.

#### Step 3: Upload Module Refactor
* **What was changed**:
  * Moved upload routing to `src/modules/upload/upload.routes.js`.
  * Updated relative imports for `authMiddleware`, `successFormatter`, and `BaseError` inside `upload.routes.js`.
  * Updated `src/index.js` to mount the new modular upload routes path.
  * Deleted the original deprecated route file `src/routes/upload.routes.js`.
* **Why it was changed**:
  * Cleaned up the technical-layered directory by colocating the upload route file into the modular `src/modules/upload/` directory.
* **Files affected**:
  * `src/modules/upload/upload.routes.js` (created)
  * `src/index.js`
  * `src/routes/upload.routes.js` (deleted)
* **Verification performed**:
  * Executed Jest test suite (`pnpm test`) pre-deletion and post-deletion of original files.
* **Pass/Fail status**:
  * Pass (588/588 tests passed successfully on all runs).
* **Issues discovered**:
  * None.

#### Step 4: Clerk Webhook Module Refactor
* **What was changed**:
  * Moved webhook routing to `src/modules/webhooks/webhook.routes.js`.
  * Created `webhook.controller.js` to verify SVIX signature and handle route extraction.
  * Created `webhook.service.js` to run data persistence queries through `userRepository` (rather than direct imports of the `User` model, resolving Finding 2.1).
  * Updated `src/index.js` to mount the new modular webhook routes.
  * Deleted the original deprecated routes file `src/routes/webhook.routes.js`.
* **Why it was changed**:
  * Adhered to the Single Responsibility Principle and MVC boundaries by decoupling HTTP routing concerns from SVIX signature checking and repository persistence workflows.
* **Files affected**:
  * `src/modules/webhooks/webhook.routes.js` (created)
  * `src/modules/webhooks/webhook.controller.js` (created)
  * `src/modules/webhooks/webhook.service.js` (created)
  * `src/index.js`
  * `src/routes/webhook.routes.js` (deleted)
* **Verification performed**:
  * Executed Jest test suite (`pnpm test`) pre-deletion and post-deletion of original files.
* **Pass/Fail status**:
  * Pass (588/588 tests passed successfully on all runs).
* **Issues discovered**:
  * None.

#### Step 5: Skills Module Refactor
* **What was changed**:
  * Created `skill.model.js`, `skill.validator.js`, `skill.repository.js`, `skill.service.js`, `skill.controller.js`, and `skill.routes.js` under `src/modules/skills/`.
  * Added `findAgentsUsingSkill` and `removeSkillFromAgents` to `agentRepository` to decouple database queries from the services.
  * In `skill.service.js`, replaced all direct imports and queries to the `Agent` model with calls to `agentRepository` (resolving cross-domain db queries, Finding 2.1).
  * Updated imports in `src/index.js`, `src/controllers/profile.controller.js`, `src/cron/deleteInactiveUsers.js`, `src/utils/skillLibraryStore.js`, `scripts/migrate-skill-snippets-to-files.js`, and `src/tools/builder.tools.js`.
  * Updated imports and mock definitions in test files (`tests/cascadingDeletes.test.js`, `tests/cronDeleteInactiveUsers.test.js`, `tests/skillLibrary.test.js`, and `tests/architect_improvement.test.js`).
  * Deleted all old deprecated skill files in technical layers.
* **Why it was changed**:
  * Unified the Skills domain within `src/modules/skills/` and successfully encapsulated model access inside their respective repositories to enforce clean architectural boundaries.
* **Files affected**:
  * `src/modules/skills/skill.model.js` (created)
  * `src/modules/skills/skill.validator.js` (created)
  * `src/modules/skills/skill.repository.js` (created)
  * `src/modules/skills/skill.service.js` (created)
  * `src/modules/skills/skill.controller.js` (created)
  * `src/modules/skills/skill.routes.js` (created)
  * `src/repositories/agentRepository.js`
  * `src/index.js`
  * `src/controllers/profile.controller.js`
  * `src/cron/deleteInactiveUsers.js`
  * `src/utils/skillLibraryStore.js`
  * `scripts/migrate-skill-snippets-to-files.js`
  * `src/tools/builder.tools.js`
  * `tests/cascadingDeletes.test.js`
  * `tests/cronDeleteInactiveUsers.test.js`
  * `tests/skillLibrary.test.js`
  * `tests/architect_improvement.test.js`
  * `src/routes/skill.routes.js` (deleted)
  * `src/controllers/skill.controller.js` (deleted)
  * `src/services/skill.service.js` (deleted)
  * `src/repositories/skillRepository.js` (deleted)
  * `src/models/Skill.js` (deleted)
  * `src/validators/skill.validator.js` (deleted)
* **Verification performed**:
  * Executed Jest test suite (`pnpm test`) pre-deletion and post-deletion of original files.
* **Pass/Fail status**:
  * Pass (588/588 tests passed successfully on all runs).
* **Issues discovered**:
  * None.

#### Step 6: Providers Module Refactor
* **What was changed**:
  * Created modular provider files (`provider.model.js`, `provider.validator.js`, `provider.repository.js`, `provider.service.js`, `provider.controller.js`, `provider.routes.js`) under `src/modules/providers/`.
  * Added `findAgentsUsingProvider` to `agentRepository`.
  * In `provider.service.js`, replaced all direct imports and queries to the `Agent` model with calls to `agentRepository` (resolving cross-domain db queries, Finding 2.1).
  * Updated imports in `src/index.js`, `src/factories/agentFactory.js`, `src/services/knowledge.service.js`, `src/tools/builder.tools.js`, `src/controllers/profile.controller.js`, and `src/cron/deleteInactiveUsers.js`.
  * Updated imports and mock definitions in test files (`tests/providerService.test.js`, `tests/providerController.test.js`, `tests/providerRepository.test.js`, `tests/providerValidator.test.js`, `tests/architect_improvement.test.js`, `tests/builderFlow.test.js`, `tests/knowledgeService.test.js`, `tests/cascadingDeletes.test.js`, and `tests/cronDeleteInactiveUsers.test.js`).
  * Deleted all old deprecated provider files in technical layers.
* **Why it was changed**:
  * Unified the Providers domain within `src/modules/providers/` and encapsulated model access inside repositories to enforce clean architectural boundaries.
* **Files affected**:
  * `src/modules/providers/provider.model.js` (created)
  * `src/modules/providers/provider.validator.js` (created)
  * `src/modules/providers/provider.repository.js` (created)
  * `src/modules/providers/provider.service.js` (created)
  * `src/modules/providers/provider.controller.js` (created)
  * `src/modules/providers/provider.routes.js` (created)
  * `src/repositories/agentRepository.js`
  * `src/index.js`
  * `src/factories/agentFactory.js`
  * `src/services/knowledge.service.js`
  * `src/tools/builder.tools.js`
  * `src/controllers/profile.controller.js`
  * `src/cron/deleteInactiveUsers.js`
  * `tests/providerService.test.js`
  * `tests/providerController.test.js`
  * `tests/providerRepository.test.js`
  * `tests/providerValidator.test.js`
  * `tests/architect_improvement.test.js`
  * `tests/builderFlow.test.js`
  * `tests/knowledgeService.test.js`
  * `tests/cascadingDeletes.test.js`
  * `tests/cronDeleteInactiveUsers.test.js`
  * `src/routes/provider.routes.js` (deleted)
  * `src/controllers/provider.controller.js` (deleted)
  * `src/services/provider.service.js` (deleted)
  * `src/repositories/providerRepository.js` (deleted)
  * `src/models/Provider.js` (deleted)
  * `src/validators/provider.validator.js` (deleted)
* **Verification performed**:
  * Executed Jest test suite (`pnpm test`) pre-deletion and post-deletion of original files.
* **Pass/Fail status**:
  * Pass (588/588 tests passed successfully on all runs).
* **Issues discovered**:
  * None.

#### Step 7: Users & Profile Module Refactor
* **What was changed**:
  * Created modular user files under `src/modules/users/`: `user.model.js`, `user.repository.js`, `user.service.js`, `profile.controller.js`, `profile.routes.js`, `profile.validator.js`, `admin.controller.js`, and `admin.routes.js`.
  * Removed duplicate definition of the `username` property inside `user.model.js`.
  * Extracted cascading account deletion logic from `profile.controller.js` to a new `userService.deleteUser` method inside `user.service.js`.
  * Refactored `userService.deleteUser` to perform resource cleanup using domain repository calls (`threadRepository.deleteAllByUser`, `agentRepository.deleteManyByOwner`, `skillRepository.deleteManyByOwner`, `providerRepository.deleteManyByOwner`, `mcpRepository.deleteManyByOwner`, `mcpUserConnectionRepository.deleteManyByUser`) rather than direct Mongoose model operations (satisfying Finding 2.1 encapsulation).
  * Refactored `adminController.deleteUser` to also leverage `userService.deleteUser` to prevent orphaning resources when deleted by administrators.
  * Updated imports in `src/index.js`, `src/repositories/index.js`, `src/modules/auth/auth.service.js`, `src/modules/webhooks/webhook.service.js`, `src/services/memory.service.js`, `src/services/agent.service.js`, `scripts/db-check.js`, `scripts/migrate-memories-to-files.js`, and `src/cron/deleteInactiveUsers.js`.
  * Corrected imports and mock paths in tests (`tests/adminController.test.js`, `tests/profileValidator.test.js`, `tests/adminMiddleware.test.js`, `tests/agentService.test.js`, `tests/cascadingDeletes.test.js`, and `tests/cronDeleteInactiveUsers.test.js`).
  * Deleted legacy technical-layered files.
* **Why it was changed**:
  * Grouped the Users, Profile, and Admin functionalities into `src/modules/users/` to form a cohesive domain boundary, simplified the Mongoose model schema, and encapsulated cross-domain deletions within `user.service.js`.
* **Files affected**:
  * `src/modules/users/user.model.js` (created)
  * `src/modules/users/user.repository.js` (created)
  * `src/modules/users/user.service.js` (created)
  * `src/modules/users/profile.controller.js` (created)
  * `src/modules/users/profile.routes.js` (created)
  * `src/modules/users/profile.validator.js` (created)
  * `src/modules/users/admin.controller.js` (created)
  * `src/modules/users/admin.routes.js` (created)
  * `src/repositories/agentRepository.js`
  * `src/modules/skills/skill.repository.js`
  * `src/modules/providers/provider.repository.js`
  * `src/repositories/mcpRepository.js`
  * `src/repositories/mcpUserConnectionRepository.js`
  * `src/index.js`
  * `src/repositories/index.js`
  * `src/modules/auth/auth.service.js`
  * `src/modules/webhooks/webhook.service.js`
  * `src/services/memory.service.js`
  * `src/services/agent.service.js`
  * `scripts/db-check.js`
  * `scripts/migrate-memories-to-files.js`
  * `src/cron/deleteInactiveUsers.js`
  * `tests/adminController.test.js`
  * `tests/profileValidator.test.js`
  * `tests/adminMiddleware.test.js`
  * `tests/agentService.test.js`
  * `tests/cascadingDeletes.test.js`
  * `tests/cronDeleteInactiveUsers.test.js`
  * `src/routes/profile.routes.js` (deleted)
  * `src/routes/admin.routes.js` (deleted)
  * `src/controllers/profile.controller.js` (deleted)
  * `src/controllers/admin.controller.js` (deleted)
  * `src/repositories/userRepository.js` (deleted)
  * `src/models/User.js` (deleted)
  * `src/validators/profile.validator.js` (deleted)
* **Verification performed**:
  * Executed Jest test suite (`pnpm test`) pre-deletion and post-deletion of original files.
* **Pass/Fail status**:
  * Pass (588/588 tests passed successfully on all runs).
* **Issues discovered**:
  * None.

#### Step 8: Threads & Checkpoints Module Refactor
* **What was changed**:
  * Created modular thread files under `src/modules/threads/`: `thread.model.js` (renamed from `Conversation.js`), `thread.repository.js`, `checkpoint.service.js`, `thread.controller.js`, `thread.routes.js`, and `thread.validator.js`.
  * Updated relative imports inside modular files.
  * Updated imports in `src/index.js`, `src/modules/users/user.service.js`, `src/routes/agui.routes.js`, `src/services/memory.service.js`, and `src/cron/deleteInactiveUsers.js`.
  * Updated imports and mock definitions in test files (`tests/cascadingDeletes.test.js`, `tests/checkpointService.test.js`, `tests/rateLimitIntegration.test.js`, `tests/statelessResumption.test.js`, `tests/threadController.test.js`, `tests/threadRepository.test.js`, and `tests/cronDeleteInactiveUsers.test.js`).
  * Deleted legacy technical-layered files.
* **Why it was changed**:
  * Co-located thread and checkpointer logic inside `src/modules/threads/` to enforce modular domain alignment.
* **Files affected**:
  * `src/modules/threads/thread.model.js` (created)
  * `src/modules/threads/thread.repository.js` (created)
  * `src/modules/threads/checkpoint.service.js` (created)
  * `src/modules/threads/thread.controller.js` (created)
  * `src/modules/threads/thread.routes.js` (created)
  * `src/modules/threads/thread.validator.js` (created)
  * `src/index.js`
  * `src/modules/users/user.service.js`
  * `src/routes/agui.routes.js`
  * `src/services/memory.service.js`
  * `src/cron/deleteInactiveUsers.js`
  * `tests/cascadingDeletes.test.js`
  * `tests/checkpointService.test.js`
  * `tests/rateLimitIntegration.test.js`
  * `tests/statelessResumption.test.js`
  * `tests/threadController.test.js`
  * `tests/threadRepository.test.js`
  * `tests/cronDeleteInactiveUsers.test.js`
  * `src/routes/thread.routes.js` (deleted)
  * `src/controllers/thread.controller.js` (deleted)
  * `src/repositories/threadRepository.js` (deleted)
  * `src/models/Conversation.js` (deleted)
  * `src/validators/thread.validator.js` (deleted)
  * `src/services/checkpoint.service.js` (deleted)
* **Verification performed**:
  * Executed Jest test suite (`pnpm test`) pre-deletion and post-deletion of original files.
* **Pass/Fail status**:
  * Pass (588/588 tests passed successfully on all runs).
* **Issues discovered**:
  * None.

#### Step 9: MCP Module Refactor
* **What was changed**:
  * Created modular MCP files under `src/modules/mcp/`: `mcp.model.js`, `mcp-user-connection.model.js`, `mcp.validator.js`, `mcp.repository.js`, `mcp-user-connection.repository.js`, `mcp.service.js`, `mcp-token.service.js`, `mcp.controller.js`, `mcp.routes.js`, `mcp-oauth-client.js`, and `oauth-state.js`.
  * Decoupled `mcp.service.js` from direct Mongoose calls to `Agent` by adding `findAgentsUsingMcp` and `removeMcpFromAgents` to `agentRepository.js`.
  * Updated relative imports inside modular files.
  * Updated imports in `src/index.js`, `src/cron/deleteInactiveUsers.js`, `src/tools/mcp.tools.js`, and `src/modules/users/user.service.js`.
  * Updated imports, mocks, and test assertions in test files (`tests/cascadingDeletes.test.js`, `tests/cronDeleteInactiveUsers.test.js`, `tests/mcpRepository.test.js`, `tests/mcpUserConnectionRepository.test.js`, `tests/mcpToken.service.test.js`, `tests/mcp.tools.test.js`, `tests/mcp.validator.test.js`, and `tests/mcp.service.test.js`).
  * Deleted legacy technical-layered files.
* **Why it was changed**:
  * Co-located MCP client, oauth, token, and database operations inside `src/modules/mcp/` to enforce modular domain boundaries and encapsulation of Mongoose model queries behind repositories.
* **Files affected**:
  * `src/modules/mcp/mcp.model.js` (created)
  * `src/modules/mcp/mcp-user-connection.model.js` (created)
  * `src/modules/mcp/mcp.validator.js` (created)
  * `src/modules/mcp/mcp.repository.js` (created)
  * `src/modules/mcp/mcp-user-connection.repository.js` (created)
  * `src/modules/mcp/mcp.service.js` (created)
  * `src/modules/mcp/mcp-token.service.js` (created)
  * `src/modules/mcp/mcp.controller.js` (created)
  * `src/modules/mcp/mcp.routes.js` (created)
  * `src/modules/mcp/mcp-oauth-client.js` (created)
  * `src/modules/mcp/oauth-state.js` (created)
  * `src/repositories/agentRepository.js`
  * `src/cron/deleteInactiveUsers.js`
  * `src/tools/mcp.tools.js`
  * `src/index.js`
  * `src/modules/users/user.service.js`
  * `tests/cascadingDeletes.test.js`
  * `tests/cronDeleteInactiveUsers.test.js`
  * `tests/mcpRepository.test.js`
  * `tests/mcpUserConnectionRepository.test.js`
  * `tests/mcpToken.service.test.js`
  * `tests/mcp.tools.test.js`
  * `tests/mcp.validator.test.js`
  * `tests/mcp.service.test.js`
  * `src/routes/mcp.routes.js` (deleted)
  * `src/controllers/mcp.controller.js` (deleted)
  * `src/repositories/mcpRepository.js` (deleted)
  * `src/repositories/mcpUserConnectionRepository.js` (deleted)
  * `src/models/Mcp.js` (deleted)
  * `src/models/McpUserConnection.js` (deleted)
  * `src/validators/mcp.validator.js` (deleted)
  * `src/services/mcp.service.js` (deleted)
  * `src/services/mcpToken.service.js` (deleted)
  * `src/utils/mcpOAuthClient.js` (deleted)
  * `src/utils/oauthState.js` (deleted)
* **Verification performed**:
  * Executed Jest test suite (`pnpm test`) pre-deletion and post-deletion of original files.
* **Pass/Fail status**:
  * Pass (588/588 tests passed successfully on all runs).
* **Issues discovered**:
  * None.
