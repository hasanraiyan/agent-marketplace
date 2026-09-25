# Audit Module

## Purpose

Provides immutable compliance and security audit logging for Developer Studio actions. Tracks administrative events, API credential minting/revocation, project configuration changes, agent updates, and secret modifications across multi-tenant projects.

## Location

`src/modules/audit/`

## Structure

```
src/modules/audit/
├── index.js                     # Barrel exports
├── auditLog.model.js            # Mongoose schema for structured audit log events
├── auditLog.repository.js       # Query and append operations
└── auditLog.service.js          # Event emission and filtering helpers
```

## Responsibilities

- **Structured Event Capture**: Records actor details (Clerk user ID, machine credential), target resource (agent, workflow, secret, credential), action verb (`CREATE`, `UPDATE`, `DELETE`, `PUBLISH`, `ROTATE`), IP address, and request metadata.
- **Tamper-Resistant Storage**: Audit records are append-only; update and delete operations are strictly prohibited at the database repository layer.
- **Tenant Scoping & Filtering**: Logs are partitioned by `domain` / `projectId` with paginated retrieval for project owners and platform compliance inspection.

## Public API & Endpoints

Mounted under `/api/v1/developer/projects/{projectId}/audit-logs`:

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | ProjectAdmin | Retrieve paginated audit events with action/actor filters |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `auth` module | Internal | Supplies actor identity from authenticated requests |
| `projects` module | Internal | Scopes audit trails to project domains |
