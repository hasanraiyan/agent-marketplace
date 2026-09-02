# Changelog

## 0.1.3 — 2026-09-03

- Bump `@personaai/runtime` to `^0.5.4` and `@personaai/sdk` to `^0.4.5` to consume `@personaai/logger@^0.1.0` re-export (no code change, still OFF by default).

## 0.1.2 — 2026-09-03

- **Built-in logging** — OFF by default, selectable per instance via `logLevel` / `logger` on `PersonaModule.forRoot` / `forRootAsync` (forwarded to `createRuntime`). Uses `createLogger('adapter:nestjs')` with child namespaces `adapter:nestjs:module`, `adapter:nestjs:middleware`, `adapter:nestjs:service`, `adapter:nestjs:translate`, `adapter:nestjs:multipart`, `adapter:nestjs:write`, `adapter:nestjs:client`. Every level visible: `off < error < warn < info < debug < trace`. Secrets (credentials, `Authorization` header) are never logged. Bump `@personaai/runtime` to `^0.5.3` and `@personaai/sdk` to `^0.4.4` to consume the shared logger. Re-exports `Logger`, `LogLevel`, `createLogger`, `createNoopLogger` from `src/index.ts` for convenience.

## 0.1.1 — 2026-08-15

- Patch: align dependency ranges and docs after runtime 0.5.2 release (no API change).

## 0.1.0 — 2026-08-10

First release of `@personaai/nestjs` — the NestJS adapter for `@personaai/runtime` (Wave 3 —
Framework Expansion, epic #227).

- **Dynamic module** — `PersonaModule.forRoot()` / `forRootAsync()` registers the runtime with sync or DI-based config; `configure()` binds `PersonaMiddleware` at `routePrefix` (default `/api/persona`).
- **Injectable service** — `PersonaService` with `forUser(id)` for scoped SDK clients and `OnModuleDestroy` clean shutdown (`runtime.close()`).
- **Middleware translation** — AG-UI SSE streaming, multipart uploads, and request translation via `toRuntimeRequest` / `writeRuntimeResponse`; coexists with body parsers and honors multer-parsed `req.file`/`req.files`.
- **Global module** — exported symbols `PERSONA_MODULE_OPTIONS`, `PERSONA_RUNTIME`, `PERSONA_CLIENT` for advanced injection.
- Tests (1) with `@nestjs/testing` — no network; NestJS 10/11 support.
