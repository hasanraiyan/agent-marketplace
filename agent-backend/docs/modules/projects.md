# Projects Module

The **Projects** module manages multi-tenant developer organizations, team memberships, role-based access control, machine credentials, invitations, and encrypted project secrets.

## Overview

Projects represent external applications or organizations utilizing Persona's agent infrastructure. All resources created under a Project share an isolated `domain` namespace, preventing cross-tenant data leakage while enabling collaborative agent creation.

## Directory Structure

```
src/modules/projects/
├── index.js                       # Barrel export of routers and services
├── project.model.js               # Project document schema (domain, name, avatar, isDeleted)
├── project.repository.js          # Mongoose repository with returnDocument: 'after'
├── project.service.js             # Project lifecycle logic, domain slugification, audit hooks
├── project.controller.js          # HTTP endpoints for /api/v1/projects
├── project.routes.js              # Express router for Project CRUD
├── project.validator.js           # Zod schemas for project creation/updates
├── projectMembership.model.js     # User-project mapping with 'admin' | 'member' roles
├── projectMembership.repository.js# Membership persistence
├── projectMembership.service.js   # RBAC validation, last-admin safeguards
├── projectInvitation.model.js     # Secure invitation tokens with expiry
├── projectInvitation.repository.js# Invitation persistence
├── projectInvitation.service.js   # Invitation creation, token verification, mail sending
├── projectCredential.model.js     # Machine API keyId and hashed secret
├── projectCredential.repository.js# Credential persistence
├── projectCredential.service.js   # Minting <keyId>.<secret>, bcrypt hashing, revocation
├── projectSecret.model.js         # Encrypted project environment variables
├── projectSecret.repository.js    # Secret persistence
├── projectSecret.service.js       # AES-256-GCM encryption/decryption, masking
├── projectSecret.validator.js     # Zod schema for secret keys/values
├── projectAgentTest.controller.js # Test runner for project agents
├── projectAgentTest.routes.js     # /api/v1/projects/:projectId/agents/:agentId/test
├── projectArchitect.controller.js # System Architect agent for project scoping
└── projectArchitect.routes.js     # /api/v1/projects/:projectId/architect
```

## Key Capabilities

1. **Multi-Tenant Domain Scoping**: Every Project receives a unique `domain` slug. All associated resources (agents, skills, knowledge bases, workflows) inherit this domain filter.
2. **Role-Based Access Control**:
   - `admin`: Can invite/remove members, mint credentials, configure secrets, modify project settings, and delete the project.
   - `member`: Can create, build, and test agents, skills, and workflows within the project.
3. **Machine Credential Minting**: Generates `<keyId>.<secret>` credentials used by `@personaai/sdk` with hashed secret verification.
4. **Encrypted Secrets**: Project configuration values (third-party API tokens, webhook signing keys) are encrypted using AES-256-GCM and masked on retrieval.
5. **Soft Deletion & Cascading Purge**: When a project is deleted, its status is marked `isDeleted: true`. The `cleanupDeletedProject` Agenda job asynchronously cleans up all associated resources after a safety buffer.

## API Endpoints

| Method   | Path                                          | Auth  | Description                                    |
| -------- | --------------------------------------------- | ----- | ---------------------------------------------- |
| `GET`    | `/api/v1/projects`                            | Clerk | List all projects the user is a member of      |
| `POST`   | `/api/v1/projects`                            | Clerk | Create a new project (caller becomes Admin)    |
| `GET`    | `/api/v1/projects/:projectId`                 | Clerk | Get project details (requires membership)      |
| `PATCH`  | `/api/v1/projects/:projectId`                 | Clerk | Update project metadata (Admin only)           |
| `DELETE` | `/api/v1/projects/:projectId`                 | Clerk | Soft-delete project (Admin only)               |
| `GET`    | `/api/v1/projects/:projectId/members`         | Clerk | List project members                           |
| `POST`   | `/api/v1/projects/:projectId/invitations`     | Clerk | Invite colleague via email (Admin only)        |
| `DELETE` | `/api/v1/projects/:projectId/members/:userId` | Clerk | Remove member (Admin only)                     |
| `POST`   | `/api/v1/projects/:projectId/credentials`     | Clerk | Mint new machine API credential (Admin only)   |
| `GET`    | `/api/v1/projects/:projectId/credentials`     | Clerk | List active machine credentials (Admin only)   |
| `DELETE` | `/api/v1/projects/:projectId/credentials/:id` | Clerk | Revoke machine credential (Admin only)         |
| `GET`    | `/api/v1/projects/:projectId/secrets`         | Clerk | List masked project secrets                    |
| `POST`   | `/api/v1/projects/:projectId/secrets`         | Clerk | Create or update encrypted secret (Admin only) |
| `DELETE` | `/api/v1/projects/:projectId/secrets/:name`   | Clerk | Delete secret (Admin only)                     |
