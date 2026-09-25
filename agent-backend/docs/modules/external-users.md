# External Users Module

## Purpose

Anchors external end-user identities (`externalUserId`) to Projects in multi-tenant environments. When third-party applications integrate with Persona via `ProjectRuntime` credentials (API keys), this module ensures that conversations, threads, checkpoints, and permissions remain strictly isolated per external user within each tenant namespace (`domain` / `projectId`).

## Location

`src/modules/externalUsers/`

## Structure

```
src/modules/externalUsers/
├── index.js                     # Barrel exports
├── externalUser.model.js        # Mongoose schema for ExternalUser anchors
├── externalUser.repository.js   # JIT find-or-create and lookups
└── externalUser.service.js      # Business logic & principal context resolution
```

## Responsibilities

- **Just-In-Time (JIT) Identity Resolution**: Automatically resolves or creates external user anchor records via `resolveOrCreate(project, externalUserId)` upon incoming authenticated requests.
- **Tenant Isolation**: Compound unique indexing on `(project, externalUserId)` guarantees zero cross-tenant identity collisions.
- **Metadata Persistence**: Tracks custom attributes (phone numbers, caller profiles, external tags) associated with external user entities.
- **Resource Ownership Anchor**: Serves as the foreign key target for conversation threads (`Conversation.externalUserId`), voice sessions, and workflow runs.

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `auth` module | Internal | Supplies `ProjectRuntimeContext` |
| `threads` module | Internal | Filters threads and conversation history by `subjectFilter` |
| `twilio` / `voice` | Internal | Resolves caller phone numbers to external user records |
