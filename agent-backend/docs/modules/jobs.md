# Background Jobs Module (Agenda)

The **Jobs** module provides distributed background task scheduling and persistence powered by **Agenda** (`@agendajs/mongo-backend`).

## Overview

While `src/modules/cron/` manages simple node-cron recurring schedules (such as nightly inactive user purges), `src/modules/jobs/` handles complex distributed, retryable, and stateful background workflows that survive process restarts.

## Directory Structure

```
src/modules/jobs/
├── agenda.js                         # Agenda instance singleton, lifecycle handlers, start/stop
├── cleanupDeletedProject.job.js       # Background job definition for cascading project cleanup
└── recoverOrphanWorkflowRuns.job.js  # Detection and resumption of interrupted workflow executions
```

## Key Jobs

### 1. `cleanup-deleted-project`

- **Trigger**: Dispatched when a Project is soft-deleted by an Admin.
- **Grace Period**: Scheduled to run after a retention safety buffer (default 7 days).
- **Execution**: Cascades deletion across all scoped collections:
  - Deletes all Agents, Skills, Knowledge Bases, MCP Connectors, and Providers belonging to the Project domain.
  - Purges all Stores and Store files.
  - Deletes all Developer Threads, checkpoints, and External Users.
  - Revokes all Project Credentials and purges Project Secrets.
  - Hard-deletes the `Project` and `ProjectMembership` records.

### 2. `recover-orphan-workflow-runs`

- **Trigger**: Runs on startup and periodically (every 5 minutes).
- **Execution**: Scans `WorkflowRun` documents in `running` status where the heartbeats or last activity exceeded the timeout threshold. Re-enqueues or marks them as failed to ensure workflow states do not remain stuck indefinitely after unexpected server terminations.

## Lifecycle Management

- **Graceful Startup**: Initialized in `src/index.js` via `await startAgenda()`. Ensures indexes are built and worker concurrency is throttled.
- **Graceful Shutdown**: On `SIGTERM` or test teardown, `stopAgenda()` pauses new job pickup and explicitly invokes `agenda._backend.disconnect()` to release active MongoDB client connections and prevent open handles.
