# Concepts — cross-SDK, version-agnostic

These pages are **shared across all 4 JS SDKs** — one place fixes all. Versioned SDK guides link here instead of duplicating.

Planned pages (greenfield will author from scratch, not copy legacy):

- `credentials.mdx` — Project credential lifecycle (mint/revoke, `SUSPENDED` blocks immediately)
- `external-users.mdx` — `externalUserId` dual-mode (control-plane vs runtime-plane) + when to assert
- `threads.mdx` — Threads & Memory & Stores mental model
- `agui-events.mdx` — AG-UI event table
- `context-vs-override.mdx` — `context` (never-shown, RCP-only) vs `contextOverride` (prompt-appended)
- `errors.mdx` — Errors · Pagination · Idempotency · `whoami()`
- `workflows.mdx` — Workflow graph (nodes/edges/trigger/draft/publishedVersion)

Each is rendered alongside versioned docs via `platform/src/lib/docs/mdx.ts` future `content/concepts/` reader (or symlinked into each version's nav as "Concepts" group).
