# @personaai/nestjs

NestJS adapter for [Persona](https://persona.hasanraiyan.me) — a dynamic module, injectable service, and middleware for mounting the Persona runtime in a NestJS application.

> **v0.1.0.** Requires NestJS 10 or 11. Server-side only — never bundles the credential.

## Install

```bash
npm install @personaai/nestjs
```

## Quickstart

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { PersonaModule } from '@personaai/nestjs';

@Module({
  imports: [
    PersonaModule.forRoot({
      baseUrl: process.env.PERSONA_BASE_URL!,
      credential: process.env.PERSONA_CREDENTIAL!,
      resolveUser: (request) => request.headers['x-user-id'] ?? null,
    }),
  ],
})
export class AppModule {}
```

The runtime surface is now mounted at `/api/persona/*` — streaming chat, threads, files, memory, MCP OAuth, and health.

## Key features

- **`PersonaModule.forRoot()` / `forRootAsync()`** — register the runtime with sync or DI-based config
- **`PersonaService`** — injectable service with `forUser(id)` for scoped SDK clients
- **`PersonaMiddleware`** — handles AG-UI SSE streaming, multipart uploads, and request translation
- **Clean shutdown** — implements `OnModuleDestroy`, calls `runtime.close()` automatically

## Full documentation

**[persona.hasanraiyan.me/guides/nestjs/quickstart](https://persona.hasanraiyan.me/guides/nestjs/quickstart)** — quickstart, auth, routes, uploads, and streaming docs.

## Dependencies

- `@personaai/runtime` ^0.5.1 (installed automatically)
- `@nestjs/common` ^10 || ^11 (peer dependency)
- `@nestjs/core` ^10 || ^11 (peer dependency)
