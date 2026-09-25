# Stores Module

## Purpose

Provides managed, isolated key-value and document persistence for Project Agents via **Project Store Mounts**. Stores allow agents to read and write arbitrary structured state across multiple conversation turns with configurable access permissions (`readonly` or `readwrite`).

## Location

`src/modules/stores/`

## Structure

```
src/modules/stores/
├── index.js                     # Barrel exports
├── store.model.js               # Mongoose schema for Store configurations
├── store.repository.js          # Database queries & tenant scoping
├── store.service.js             # Store CRUD, mount resolution & data operations
├── store.validator.js           # Zod validation schemas
└── storeNamespace.js            # Key prefixing & namespace isolation logic
```

## Responsibilities

- **Tenant-Scoped State Storage**: Manages isolated stores bound to specific projects (`projectId`).
- **Permission Modes**: Enforces `readonly` (for reference data / configuration) versus `readwrite` (for agent scratchpads and long-term state).
- **Agent Mount Binding**: Attaches stores to agents via `agent.storeMounts`, exposing structured tools (`store_get`, `store_set`, `store_delete`, `store_list`) into the agent's LangGraph execution context.
- **Namespace Isolation**: Prevents key collisions between different agents mounting the same store via automatic namespace prefixing.

## Public API & Endpoints

Mounted under `/api/v1/developer/projects/{projectId}/stores`:

| Method   | Path    | Auth         | Purpose                        |
| -------- | ------- | ------------ | ------------------------------ |
| `GET`    | `/`     | ProjectAdmin | List project stores            |
| `POST`   | `/`     | ProjectAdmin | Create new project store       |
| `GET`    | `/{id}` | ProjectAdmin | Get store metadata             |
| `PUT`    | `/{id}` | ProjectAdmin | Update store configuration     |
| `DELETE` | `/{id}` | ProjectAdmin | Delete store and attached data |

## Dependencies

| Dependency        | Type     | Purpose                                     |
| ----------------- | -------- | ------------------------------------------- |
| `agents` module   | Internal | Mounts store tools to compiled agent graphs |
| `projects` module | Internal | Scopes stores to project containers         |
