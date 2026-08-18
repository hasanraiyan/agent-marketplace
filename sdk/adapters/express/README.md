# @personaai/express

Express adapter for [Persona](https://persona.hasanraiyan.me) — mount the Persona runtime as an Express Router with streaming chat, threads, files, and memory in a few lines.

> **v0.1.0.** Requires Express >= 4. Server-side only — never bundles the credential.

## Install

```bash
npm install @personaai/express
```

## Quickstart

```ts
import express from 'express';
import { createRuntime } from '@personaai/runtime';
import { toExpressRouter } from '@personaai/express';

const runtime = createRuntime({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUser: (request) => getUserIdFromSession(request.headers['cookie']),
});

const app = express();
app.use(express.json());
app.use('/api/persona', toExpressRouter(runtime));
app.listen(3000);
```

That's the whole backend — AG-UI streaming chat, threads, files, memory, MCP OAuth, and health are all available at `/api/persona/*`.

## Full documentation

**[persona.hasanraiyan.me/guides/express/quickstart](https://persona.hasanraiyan.me/guides/express/quickstart)** — quickstart, auth, routes, uploads, streaming, and disconnect handling.

## Dependencies

- `@personaai/runtime` ^0.5.1 (installed automatically)
- `express` >= 4 (peer dependency)
