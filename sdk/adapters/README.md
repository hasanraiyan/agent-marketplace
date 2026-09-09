# @personaai/adapters — Single Package for Express, Next.js, NestJS

Unified Persona adapter — **one install, three frameworks, one shared core**. Replaces the three separate packages `@personaai/express`, `@personaai/nextjs`, `@personaai/nestjs` with a single dependency and zero duplicated logic.

> **v0.1.0** — Server-side only. Requires Node >=18. `reflect-metadata`/`rxjs` are optional peers for NestJS only.

## Install (single dep)

```bash
npm install @personaai/adapters
# peer: install only the framework you use
# npm install express          # for Express
# npm install next react       # for Next.js
# npm install @nestjs/common @nestjs/core reflect-metadata rxjs  # for NestJS
```

## Exports

| Import | Framework | Contents |
|---|---|---|
| `@personaai/adapters/express` | Express 4/5 | `toExpressRouter`, `createExpressAdapter` |
| `@personaai/adapters/nestjs` | NestJS 10/11 | `PersonaModule`, `PersonaService`, `PersonaMiddleware` |
| `@personaai/adapters/nextjs` | Next.js 14+ | client: `PersonaProvider`, `useChat` (re-export `@personaai/react`) |
| `@personaai/adapters/nextjs/server` | Next.js 14+ | server: `createPersonaHandler`, `toNextRouteHandlers` |

All three share the same internals (`src/shared/`): `TranslationError`, `redactHeaders`, `multipart` (multer-aware + native `Request.formData`), `write` (drain/backpressure + `iterator.return()` on disconnect), and `handler-node`. Fix once, ship everywhere.

## Quickstart — Express

```ts
import express from 'express';
import { createExpressAdapter } from '@personaai/adapters/express';

const app = express();
app.use(express.json());

const persona = createExpressAdapter({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: (req) => (req as any).user?.id ?? null,
});
app.use('/api/persona', persona.router);
app.listen(3000);
```

Core primitive (two runtimes at different mounts) still works:

```ts
import { createRuntime } from '@personaai/runtime';
import { toExpressRouter } from '@personaai/adapters/express';
app.use('/api/persona', toExpressRouter(appRuntime));
app.use('/api/admin/persona', toExpressRouter(adminRuntime));
```

## Quickstart — Next.js (App Router)

```ts
// app/api/persona/[...persona]/route.ts
import { createPersonaHandler } from '@personaai/adapters/nextjs/server';
import { auth } from '@clerk/nextjs/server';

export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: async () => (await auth()).userId,
});
export const dynamic = 'force-dynamic';
```

```tsx
// app/layout.tsx
import { PersonaProvider } from '@personaai/adapters/nextjs';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PersonaProvider baseUrl="/api/persona">{children}</PersonaProvider>;
}
```

## Quickstart — NestJS

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { PersonaModule } from '@personaai/adapters/nestjs';

@Module({
  imports: [
    PersonaModule.forRoot({
      baseUrl: process.env.PERSONA_BASE_URL!,
      credential: process.env.PERSONA_CREDENTIAL!,
      resolveUserFrom: (req) => req.user?.id ?? null,
      routePrefix: '/api/persona',
    }),
  ],
})
export class AppModule {}
```

`forRootAsync` + `PersonaService.forUser(id)` (scoped SDK client) unchanged.

## Why unified?

* **No drift** — `express`/`nestjs` were 95% copy-paste (`translate` 229/235 LOC, `multipart` 190/192, `write` 150/167, `toExpressRouter` 188 vs `PersonaMiddleware` 176). `nextjs` diverged only for Web `Request`/`ReadableStream`. Now `src/shared/` is the single source of truth.
* **One publish, one version** — no `file:` inter-package links, no 2-step `core → adapters` release.
* **Back-compat** — `@personaai/express`, `@personaai/nextjs`, `@personaai/nestjs` remain as deprecated shims re-exporting from this package. Migrate by changing the import specifier alone.

## Migration from separate packages

```diff
- import { toExpressRouter } from '@personaai/express';
+ import { toExpressRouter } from '@personaai/adapters/express';

- import { createPersonaHandler } from '@personaai/nextjs/server';
+ import { createPersonaHandler } from '@personaai/adapters/nextjs/server';

- import { PersonaModule } from '@personaai/nestjs';
+ import { PersonaModule } from '@personaai/adapters/nestjs';
```

Then `npm uninstall @personaai/express @personaai/nextjs @nestjs...` and `npm install @personaai/adapters`.

## Structure

```
sdk/adapters/
  src/shared/        # errors, headers, json, multipart-node, write-node, write-web, translate-node, handler-node
  src/express/       # thin: Router + shared/handler-node
  src/nestjs/        # thin: Module/Middleware + shared/handler-node
  src/nextjs/        # server (Web Request) + client (re-export react)
  dist/              # tsup: express/index, nestjs/index, nextjs/server, nextjs/client (esm+cjs+dts)
```

## Decommission of old packages

* `@personaai/express` / `@personaai/nestjs` / `@personaai/nextjs` are now **deprecated shims** — they `export * from '@personaai/adapters/...'` and will be removed in `1.0`. New code should import from `@personaai/adapters`.
* Internal shared code (`shared/`) is **not** a published package and is not exported to consumers.

## Build

```bash
pnpm --dir sdk/adapters build
pnpm --dir sdk/adapters typecheck
pnpm --dir sdk/adapters test   # (when tests added)
```
