# Developer Platform: Projects & Multi-Tenancy FR/NFR Specification

## 1. System Overview & Purpose

The **Developer Platform** enables external applications and B2B products (e.g., Coursify, OpenFounder, Beyond Campus) to build, orchestrate, and serve AI agents using Persona's runtime infrastructure. Rather than operating under an individual user's personal account, external integrations operate within an isolated **Project** boundary with dedicated team members, machine credentials, encrypted secrets, and isolated resource domains.

---

## 2. Functional Requirements (FR)

### FR-1: Project Lifecycle & Multi-Tenancy Boundary

- **FR-1.1**: The platform must allow authenticated human users (via Clerk) to create, view, update, and soft-delete Projects.
- **FR-1.2**: Every Project has a globally unique `domain` identifier (slug), a human-readable `name`, and an `avatar`.
- **FR-1.3**: When a Project is created, the creating user is automatically assigned the `Admin` role in `ProjectMembership`.
- **FR-1.4**: All developer resources—including Agents, Skills, Knowledge Bases, MCP Connectors, Providers, Stores, Threads, and Secrets—must be scoped by the Project's `domain`.
- **FR-1.5**: Project deletion must be soft by default (`isDeleted: true`, `deletedAt: Date`). A background Agenda worker (`cleanupDeletedProject.job.js`) asynchronously cascades deletion across all scoped resources after a grace period.

### FR-2: Project Memberships & Role-Based Access Control (RBAC)

- **FR-2.1**: A Project must support two membership roles:
  - `Admin`: Full control over Project metadata, credentials, secrets, members, billing, and all Project resources.
  - `Member`: Access to create, edit, run, and test Project resources (agents, skills, knowledge), but restricted from viewing secrets, managing credentials, or inviting/removing members.
- **FR-2.2**: The last remaining `Admin` cannot leave or be removed from a Project until another member is promoted to `Admin`.
- **FR-2.3**: Memberships must track user reference, role, joining timestamp, and inviter identity.

### FR-3: Project Invitations

- **FR-3.1**: Project Admins can invite external colleagues via email.
- **FR-3.2**: An invitation must generate a secure, high-entropy token with a defined expiration (default 7 days).
- **FR-3.3**: The platform must deliver an invitation email via the `mailService` (Resend + Mailgen) with an accept link.
- **FR-3.4**: When the recipient accepts, if they already exist as a Persona user, they are added to `ProjectMembership`; if not, they complete Clerk signup and are granted membership upon first login.
- **FR-3.5**: Admins can revoke pending invitations.

### FR-4: Machine Authentication & Project Credentials

- **FR-4.1**: Admins can mint machine credentials for server-to-server API access (`POST /api/v1/projects/{projectId}/credentials`).
- **FR-4.2**: The generated credential follows the `<keyId>.<secret>` wire format.
- **FR-4.3**: The secret is hashed using `bcrypt` (or salted SHA-256) and never stored in plaintext. The plaintext secret is revealed **only once** upon creation.
- **FR-4.4**: Machine requests authenticate using standard `Authorization: Bearer <keyId>.<secret>` headers on `/api/v1/developer/*` routes.
- **FR-4.5**: Credentials can be revoked instantly by Admins, invalidating all subsequent API calls using that key.

### FR-5: Project Secrets Management

- **FR-5.1**: Projects can store sensitive environment variables and API keys (e.g. `STRIPE_KEY`, `CRM_TOKEN`, third-party LLM keys) in `ProjectSecret`.
- **FR-5.2**: Secrets must be encrypted at rest using AES-256-GCM via `src/utils/encryption.js`.
- **FR-5.3**: The read/list endpoints must return masked values (`sk-***1234`) and never leak the plaintext secret to the frontend.
- **FR-5.4**: Secrets are injected into agent execution contexts and workflow node runs during runtime execution.

### FR-6: End-User Identity Impersonation (`x-persona-external-user-id`)

- **FR-6.1**: Machine callers can execute agents on behalf of their own end-users by supplying the `x-persona-external-user-id` HTTP header.
- **FR-6.2**: The platform automatically upserts an `ExternalUser` record scoped to that Project domain.
- **FR-6.3**: Conversation threads, persistent memories, and store mounts are isolated per external user ID within the Project domain.

---

## 3. Non-Functional Requirements (NFR)

### NFR-1: Security & Confidentiality

- **Zero Cross-Tenant Leakage**: Every query on `/api/v1/developer/*` must enforce `{ domain: req.developerDomain }`. No project may ever view, query, or mutate another project's resources.
- **Key & Secret Cryptography**: Plaintext machine secrets and project configuration values must never appear in log files or unencrypted database fields.
- **Header Tampering Defense**: The `x-persona-external-user-id` header is only accepted from authenticated machine credentials (`developerMachineAuthMiddleware`), never from unauthenticated public clients.

### NFR-2: Performance & Scalability

- **Sub-30ms Credential Verification**: Machine auth checks must resolve in <30ms using indexed `keyId` lookups.
- **Efficient Idempotency Caching**: Mutation requests with an `Idempotency-Key` header must return cached results in <15ms without executing duplicate backend operations.

### NFR-3: Reliability & Auditability

- **Audit Logging**: All credential creation, revocation, member role changes, and secret updates must record an immutable `AuditLog` entry detailing actor, action, timestamp, and IP address.
- **Asynchronous Cascade**: Deletion of large projects containing thousands of threads or documents must not block HTTP request cycles; cascading cleanup is offloaded to Agenda background workers.

---

## 4. Architecture & Data Flow

```text
┌────────────────────────────────┐         ┌────────────────────────────────┐
│   Human Developer (Clerk)      │         │   Machine Caller / Customer    │
│   (Developer Studio UI)        │         │   (@personaai/sdk, Bearer Key) │
└───────────────┬────────────────┘         └───────────────┬────────────────┘
                │                                          │
                ▼                                          ▼
   Clerk Session Middleware               Machine Auth Middleware
   (checks ProjectMembership)             (validates keyId + secret hash)
                │                                          │
                └─────────────────┬────────────────────────┘
                                  │
                                  ▼
                   Resolve Project Context (`req.context`)
                   - domain: "proj_acme"
                   - role: "admin" | "machine"
                   - externalUserId: optional
                                  │
                                  ▼
                    Domain-Scoped Repository Query
                    e.g. Agent.find({ domain: "proj_acme" })
```
