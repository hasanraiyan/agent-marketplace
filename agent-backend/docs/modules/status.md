# Status Module

The **Status** module provides operational monitoring, platform component health aggregation, and diagnostic status reporting for developers and automated uptime monitors.

## Overview

Unlike lightweight health checks (`/api/v1/health` and `/api/v1/health/db`) that return boolean ping responses for load balancers, the Status module provides rich, non-blocking operational diagnostics covering database latency, AI provider reachability, vector store connectivity, and background worker queues.

## Directory Structure

```
src/modules/status/
├── index.js              # Barrel export of statusRouter
├── status.model.js       # (Optional) historical status checkpoints
├── status.repository.js  # Persistence for status metrics
├── status.service.js     # Health probe aggregation logic
├── status.controller.js  # HTTP request handlers for /api/v1/status
└── status.routes.js      # Express router
```

## Key Capabilities

1. **Multi-Subsystem Health Probes**:
   - **MongoDB**: Connection status, replica set status, ping round-trip latency.
   - **Qdrant Vector DB**: Vector collection health and cluster availability.
   - **AI Providers**: Configured provider connectivity status.
   - **Agenda Worker**: Active, queued, and failed job counts.
2. **Degraded State Handling**: If a non-critical subsystem (such as Qdrant or a specific AI provider) is slow or unreachable, the endpoint returns a `200 OK` or `207 Multi-Status` with status `degraded`, preventing full platform outages at load balancer gateways.
3. **Uptime & System Diagnostics**: Returns process uptime, memory usage (RSS, heap total, heap used), Node.js version, and active environment type.

## API Endpoints

| Method | Path             | Auth              | Description                                                |
| ------ | ---------------- | ----------------- | ---------------------------------------------------------- |
| `GET`  | `/api/v1/status` | Optional / Public | Complete platform operational status and diagnostic report |
