# Plan — Built-in Logging Across the SDK Ecosystem

> **Intent:** `prompt.md` — selectable, off-by-default, every-level logging in every SDK, client-side and server-side, built layer-by-layer from a single foundational implementation.
> **Status:** Plan — no code changes yet. Review before execution.
> **Author:** Muse Spark (2026-09-02)

---

## 1. Goal Restatement

- Every SDK in the ecosystem exposes **built-in logging** the caller can inspect.
- Caller controls it: **selectable** on/off and **selectable level**, per instance (and optionally global).
- **Off by default** — zero output unless caller explicitly enables.
- Applies **both sides**: server-side libs (Node/Python) and client-side libs (browser/React/Dart/Flutter) — not one track.
- Do **not** re-implement from scratch per package. Build once in the foundational lib, publish, then update dependants layer-by-layer to consume that published artifact.

---

## 2. Current Ecosystem & Dependency Graph (ground truth)

Verified from `sdk/*/package.json` + `pubspec.yaml` + `pyproject.toml` on 2026-09-02:

```
TS/JS server track              TS/JS client track          Other languages
─────────────────────────────────────────────────────────────────────────────
@personaai/sdk 0.4.3 (leaf)      @personaai/react 0.5.3      persona-agent-sdk 0.3.0 (Python, leaf)
   ↑  no internal deps           (currently no internal     persona_agent_client 0.1.0 (Dart, leaf)
   │   deps; only @ag-ui/core)    deps; peer react)          ↑ leaf (dio only)
   │                             persona_agent_flutter 0.1.0     └─ persona_agent_flutter (depends on client via path:)
   │
@personaai/runtime 0.5.2 ──────── depends on @personaai/sdk
   ↑
   ├── @personaai/express 0.1.1 (depends on runtime)
   ├── @personaai/nestjs 0.1.1 (depends on runtime + sdk)
   └── @personaai/nextjs 0.1.0 (depends on runtime + react)
                              @personaai/ui 0.9.1 (depends on react)
```

`package-ecosystem.md` claims `react → sdk`; actual `react/package.json` has **no** dep on sdk today. Plan must add it (or justify an alternative).

Python and Dart are **parallel foundational leaves** — they cannot import a TS logger. Each language gets its own foundational implementation following the same spec.

No existing logger found in `sdk/**` (`grep log` returns 0 hits). This is green-field with a reuse constraint.

---

## 3. Logger Design Spec (shared contract, language-idiomatic)

This is the **single spec** every package implements/consumes. Keep it tiny and isomorphic.

### 3.1 Levels (full visibility)

```
OFF (0) < ERROR (1) < WARN (2) < INFO (3) < DEBUG (4) < TRACE (5)
```

- `OFF` is the **default** — no output.
- Every level includes all levels above it (e.g. `INFO` shows `error+warn+info`).
- Trace is optional but included for wire-level detail; `debug` is the typical verbose level callers enable.

TS type:

```ts
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
export const LogLevelOrder: Record<LogLevel, number> = { off:0, error:1, warn:2, info:3, debug:4, trace:5 };
```

Python maps to `logging.CRITICAL/ERROR/WARNING/INFO/DEBUG` (TRACE = DEBUG + extra). Dart maps to `Level.OFF/SHOUT/SEVERE/WARNING/INFO/FINE/FINER`.

### 3.2 Core interface (TS)

Single file `sdk/typescript/src/logger.ts` — **zero dependencies**, no Node globals, safe to bundle in browsers.

```ts
export interface Logger {
  trace(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(namespace: string): Logger; // prefixed child, e.g. "sdk:http", "runtime:chat"
}

export interface LoggerOptions {
  level: LogLevel;          // default 'off'
  transport?: (level: LogLevel, namespace: string, msg: string, meta?: Record<string, unknown>) => void;
  // transport defaults to console.* when level !== off (console.error/warn/log/debug)
}
export function createLogger(namespace: string, opts?: Partial<LoggerOptions>): Logger;
export function setLogLevel(level: LogLevel): void; // global default for loggers created without explicit level
export function getLogLevel(): LogLevel;
```

Rules:

- **Never log secrets.** `credential`, `Authorization` header, `x-persona-*` tokens are redacted to `***` or `keyId:***`. Same for `apiKey` fields in provider routes. Logger helper `redact()` centralizes this.
- **No side effects when OFF** — level check is first line; argument construction (JSON stringify) is lazy / gated.
- **Isomorphic** — default transport detects `console` existence; no `process`, `fs`, `window`, `localStorage`. Custom `transport` lets hosts route to pino/winston/Datadog/etc. without us depending on them.
- **Child namespaces** give per-subsystem filtering without multiple global levels (e.g. `sdk:http`, `runtime:stream`, `react:chat`).

### 3.3 Configuration surfaces

Per-instance takes precedence over global. Both are explicit opt-in.

```ts
// Global (affects loggers created after the call)
import { setLogLevel } from '@personaai/sdk';
setLogLevel('debug');

// Per-client (recommended for library callers — scopes to one credential/user)
import { PersonaClient } from '@personaai/sdk';
const client = new PersonaClient({
  baseUrl, credential,
  logLevel: 'debug',          // shorthand
  // or
  logger: createLogger('my-app:sdk', { level: 'debug', transport: myTransport }),
});
```

Server uses `logLevel`/`logger` on `CreateRuntimeOptions`; client uses `PersonaProviderProps.logLevel`/`logger`. Adapters pass through the same options to `createRuntime` (no new surface beyond pass-through).

Python equivalent:

```py
# standard library — zero new deps
import logging
logging.getLogger("personaai").setLevel(logging.DEBUG)
# or per-client
client = PersonaClient(base_url=..., credential=..., log_level="debug", logger=my_logger)
```

Dart equivalent:

```dart
final client = PersonaClient(baseUrl: ..., credential: ..., logLevel: LogLevel.debug);
PersonaLogger.level = LogLevel.debug; // global
```

### 3.4 What gets logged at each level (example)

| Level | sdk (HttpClient, chat) | runtime | react / ui / dart |
|---|---|---|---|
| error | non-2xx, 429 exhausted, SSE parse failure | handle() 5xx, resolveUser throw | streaming error, reconnect failed |
| warn | 429 retry, deprecated field, retry-after | capability disabled route hit, stale run eviction | stale thread ref, missing agentId |
| info | request start/end (method+path, status, latency, no body), whoami | route matched, auth 401, stream start/end | provider mounted, chat started |
| debug | query + body keys (not secrets), retry delays, SSE frame counts | runId, params, hook invocations, heartbeat | hook state transitions, message seq |
| trace | raw headers (redacted), envelope JSON, SSE raw lines | raw RuntimeRequest/Response | raw event types |

Exact messages are defined per package during implementation, but every package must log at **every** level so the spectrum is exercised.

---

## 4. Execution Order — Layer by Layer, Publish-Gated

> Rule: never start layer N+1 until layer N is **published to the registry** and the next package bumps to that published version (no `file:` links in publish). This is the same gate `sdk/adapters/express` enforces in its `prepublishOnly`.

### Phase 0 — Prep (no publish)

- [ ] Add `sdk/typescript/src/logger.ts` to repo (isomorphic, tested).
- [ ] Decide **sharing strategy for client track** (see §4.1). Recommend: logger lives in `@personaai/sdk` as `@personaai/sdk/logger` (browser-safe subpath export), `react` adds `dependencies: { "@personaai/sdk": "^0.4.4" }` and imports from that subpath only. Tree-shakes to ~2KB; no server code bundled. Alternative — if bundle audit objects — extract to `@personaai/logger` in a follow-up (deferred extraction, not upfront).
- [ ] Define publish checklist per package (`typecheck`, `lint`, `format:check`, `test`, `build`, `npm pack --dry-run` + `prepublishOnly` file: guard).

### Phase 1 — Foundational libs (parallel per language, TS starts)

**1a. `@personaai/sdk` (TS) — v0.4.3 → v0.4.4 (minor, additive)**

- Implement `src/logger.ts` per §3.2.
- Add `HttpClientOptions.logLevel` + `logger` + global `setLogLevel` re-export.
- Instrument `HttpClient`: request start/end, 429 retry, parse errors; `ChatClient`/`ArchitectClient`: SSE frame tracing.
- Export new public API from `src/index.ts`: `LogLevel`, `createLogger`, `setLogLevel`, `getLogLevel`, `Logger`.
- Add `exports: { "./logger": { import:"./dist/logger.js", require:"./dist/logger.cjs" } }` for browser-safe import.
- Tests: `test/logger.test.ts` (level gating, OFF default, redaction, child, custom transport) + `test/http-logging.test.ts` (spy transport asserts).
- Docs: README “Logging” section; CHANGELOG 0.4.4.
- **Publish `@personaai/sdk@0.4.4`** (public, provenance). Tag git.

**1b. `persona-agent-sdk` (Python) — v0.3.0 → v0.3.1 (parallel, no dep on TS)**

- Idiomatic: use `logging.getLogger("personaai")` with `NullHandler` so OFF by default (Python convention: library does not configure handlers). Add `log_level` kwarg + `logger` injection to `PersonaClient` / `AsyncPersonaClient` and `SyncTransport`/`AsyncTransport`.
- Instrument `_sync_http.py` / `_async_http.py` + `chat/client.py` SSE.
- Tests: `tests/test_logging.py` (level, off default, redaction).
- Publish to PyPI.

**1c. `persona_agent_client` (Dart) — v0.1.0 → v0.1.1 (parallel)**

- Add `lib/src/logger.dart` (level enum, `PersonaLogger`, child, console transport, OFF default). Add `logLevel`/`logger` to `PersonaClient`/`PersonaConnectionController`/`ChatController`.
- Instrument `persona_http_client.dart` + `chat_stream.dart`.
- Tests: `test/logger_test.dart`.
- Publish to pub.dev.

### Phase 2 — Next layer (depends on published Phase 1)

**2a. `@personaai/runtime` — v0.5.2 → v0.5.3**

- Bump `dependencies: { "@personaai/sdk": "^0.4.4" }` (remove any file: link first).
- Import logger from `@personaai/sdk/logger` (or `from '@personaai/sdk'` re-export).
- Add `CreateRuntimeOptions.logLevel` + `logger`.
- Instrument: `runtime.ts` route match / 404/405 / auth 401, `routes/*.ts` param capture, `runDriver.ts` stream start/end/heartbeat/eviction, `errors.ts` sanitized vs verbose.
- Tests: `test/logger.test.ts` + asserts on `runtime.handle()` spy transport.
- **Publish `@personaai/runtime@0.5.3`.**

**2b. `@personaai/react` — v0.5.3 → v0.5.4**

- Bump `dependencies: { "@personaai/sdk": "^0.4.4" }` (new dep). If bundle size objection wins, depend on `@personaai/sdk/logger` subpath only; document that `sdk` is now required for react.
- Add `PersonaProviderProps.logLevel` + `logger`; create context-level logger and `child()` per hook.
- Instrument: `PersonaContext` fetchWithAuth, `useChat` streaming/reconnect, `useThreads`/`useFiles`/`useMemory`/`useAgents` state transitions, `streaming.ts` SSE parsing.
- Tests: vitest spy transport (jsdom), OFF default assertion.
- **Publish `@personaai/react@0.5.4`.**

### Phase 3 — Next layer (depends on published Phase 2)

**3a. `@personaai/ui` — v0.9.1 → v0.9.2**

- Bump `dependencies: { "@personaai/react": "^0.5.4" }`.
- No new logger dep — reuses react's logger via props/context. Add optional `logger` prop passthrough on top-level components (`Chat`, `ThreadSidebar`, etc.) that forwards to underlying hooks.
- Instrument render-level warnings only (e.g., missing provider) at `warn`; interaction traces at `debug`.
- **Publish `@personaai/ui@0.9.2`.**

**3b. `@personaai/express` — v0.1.1 → v0.1.2**

- Bump `dependencies: { "@personaai/runtime": "^0.5.3" }`.
- Pass through `logLevel`/`logger` via `createExpressAdapter` options (adapter itself is thin; runtime owns most logs). Add adapter-specific traces: `translate.ts` method/path/query, `multipart.ts` file counts, `write.ts` response kind/backpressure/disconnect.
- **Publish `@personaai/express@0.1.2`.**

**3c. `@personaai/nestjs` — v0.1.1 → v0.1.2**

- Bump `dependencies: { "@personaai/runtime": "^0.5.3", "@personaai/sdk": "^0.4.4" }`.
- Mirror express: module options `logLevel`/`logger`, forward to runtime; log dynamic module registration, middleware binding, injectable service calls.
- **Publish `@personaai/nestjs@0.1.2`.**

**3d. `@personaai/nextjs` — v0.1.0 → v0.1.1**

- Bump `dependencies: { "@personaai/runtime": "^0.5.3", "@personaai/react": "^0.5.4" }`.
- Server entry (`./server`) forwards logger to runtime; client entry (`"."`) re-exports react logger. Add route-handler translation logs (similar to express but for Next.js App Router).
- **Publish `@personaai/nextjs@0.1.1`.**

**3e. `persona_agent_flutter` — v0.1.0 → v0.1.1**

- Swap `path: ../persona_agent_client` → `persona_agent_client: ^0.1.1` (hosted). Bump.
- Forward logger to underlying client; add widget-lifecycle logs at `debug`.
- Publish to pub.dev **after** `persona_agent_client@0.1.1` is live.

### Phase 4 — Docs & verification

- Update `product-research/11-sdk-new/package-ecosystem.md` Wave table & dependency graph (mark logging shipped).
- Add `sdk/*/README.md` “Logging” sections (consistent copy, link to central guide).
- Add `developer-docs/guides/logging.mdx` (one page, all packages, with TS/Python/Dart tabs).
- Run cross-package smoke: `pnpm --dir sdk/typescript build && pnpm --dir sdk/runtime build && ...` with `logLevel: 'trace'` against a fake runtime — assert no secrets in output.

---

## 4.1 Sharing Strategy Note (why sdk first)

Prompt says “fix/build the logging capability in **one lib** first — the foundational one.” In JS/TS that is `@personaai/sdk` — the only internal dep of `@personaai/runtime` and (per docs) `@personaai/react`. Building logger there and then importing it upward avoids N independent console wrappers.

Concern: `sdk/package.json` says “Server-side only — never bundle into a browser app.” Importing the whole SDK into `react` would bundle server secrets logic into browsers. Mitigation:

- Logger module imports **nothing** from `http.ts`/`client.ts`; it is a leaf. We expose it as a separate export `"./logger"` with its own entry (`src/logger.ts` → `dist/logger.js`). `react` imports **only** that subpath, so bundlers tree-shake away HttpClient. Verifiable via `npm pack --dry-run` + bundle analysis (`esbuild --bundle --analyze`).
- If analysis shows >3KB extra or any `node:` import leaks, fallback is to extract logger into `@personaai/logger` (new micro-package) after Phase 1 — still satisfying “one lib first” because extraction is a mechanical move of the already-published code, not a second implementation.

We proceed with the subpath approach first; extraction is the escape hatch, not the plan.

---

## 5. Versioning & Publish Gates

- TS/JS: **minor or patch** (additive, non-breaking). No API removed. Pre-publish check identical to `sdk/adapters/express`: `prepublishOnly` refuses any `file:` dep. Each publish is manual (no GH workflow yet) — record maintainer approval per `sdk/adapters/express/PLAN.md` §12.
- Python: patch bump, `hatch build` + `twine upload`, `CHANGELOG.md` entry.
- Dart: `dart pub publish --dry-run` then publish; flutter package publishes **after** its client dep.

Order is a **DAG**, not arbitrary. Do not parallelize across dependency edges.

```
sdk@0.4.4 ─┬─→ runtime@0.5.3 ─┬─→ express@0.1.2
           │                 ├─→ nestjs@0.1.2
           │                 └─→ nextjs@0.1.1 (also needs react@0.5.4)
           └─→ react@0.5.4 ───┬─→ ui@0.9.2
                             └─→ nextjs@0.1.1
python 0.3.1 (parallel track)
dart client 0.1.1 → flutter 0.1.1 (parallel track)
```

---

## 6. Testing & Verification per Phase

Each phase must pass before publish:

```
pnpm --dir sdk/<pkg> typecheck
pnpm --dir sdk/<pkg> lint
pnpm --dir sdk/<pkg> format:check
pnpm --dir sdk/<pkg> test            # vitest, include new logging tests
pnpm --dir sdk/<pkg> build
npm pack --dry-run                   # inspect dist + exports
```

New tests must assert:

- OFF default: zero calls to transport when no `logLevel` set.
- Every level gates correctly (error visible at warn, debug hidden at info, trace hidden at debug).
- Redaction: credential / Bearer / apiKey never appears in any level's output.
- Custom transport receives `(level, namespace, msg, meta)`.
- Child logger prefixes namespace.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| React bundling server code | Isolate logger as subpath leaf, no imports from HttpClient; verify with bundle analysis; fallback to `@personaai/logger` extraction |
| Secret leakage in logs | Central `redact()` + tests that assert `***` for credential-bearing fields at every level |
| Log spam when enabled | Namespaces + levels; trace is very verbose and opt-in only; info is concise (method+path+status) |
| Breaking “server-side only” claim | Logger subpath docs explicitly “browser-safe”; top-level `@personaai/sdk` remains server-only — only `./logger` is safe to import in browsers |
| Publish order mistakes (file: links) | Reuse `prepublishOnly` guard from express/nestjs; CI check `pnpm -r exec node -e "if(Object.values(require('./package.json').dependencies||{}).some(v=>String(v).startsWith('file:')))process.exit(1)"` |
| Python/Dart spec drift | Single spec doc (§3) with language mapping table; reviewer cross-checks levels before publish |

---

## 8. Checklist Before Writing Code

- [ ] Reviewer approves this plan and §4.1 sharing strategy
- [ ] Confirm version bumps (patch vs minor) with maintainer
- [ ] Confirm `react` adding `dependencies: { "@personaai/sdk": "^0.4.4" }` is acceptable vs extracting `@personaai/logger`

---

## 9. References

- `prompt.md` (source intent)
- `product-research/11-sdk-new/package-ecosystem.md:24-63` (dependency graph)
- `sdk/typescript/package.json:3-55`, `sdk/runtime/package.json:4-55`, `sdk/react/package.json:4-56` (verified versions/deps)
- `sdk/runtime/src/types/options.ts:44-87` (CreateRuntimeOptions shape to extend)
- `sdk/react/src/types.ts:108-116` (PersonaProviderProps shape to extend)
- `sdk/typescript/src/http.ts:3-171` (HttpClient to instrument first)
- `sdk/adapters/express/PLAN.md:184-199` (publish gate pattern)
