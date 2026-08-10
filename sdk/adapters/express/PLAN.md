# Plan — `@personaai/express` (Express Adapter)

> **Issue:** [#228 — [SDK Ecosystem] @personaai/express — Express Adapter](https://github.com/hasanraiyan/agent-marketplace/issues/228)
> **Epic:** [#227 — Persona SDK Ecosystem](https://github.com/hasanraiyan/agent-marketplace/issues/227) (Wave 3 — Framework Expansion)
> **Depends on:** `@personaai/runtime` (Wave 1) — currently **v0.5.1**
> **Location:** `sdk/adapters/express/` (per AGENTS.md: `sdk/adapters/ # future: nextjs, express, fastify, hono, nestjs, node`)
> **Status:** Plan — not yet implemented

---

## 1. Summary

`@personaai/express` exposes the Persona runtime as an **Express Router**. A developer mounts it in one line —

```ts
app.use('/api/persona', toExpressRouter(runtime));
```

— and gets the entire runtime surface (AG-UI chat streaming, threads, files, memory, MCP OAuth, health) without writing any plumbing. The adapter is a **pure translation layer** between Express `req`/`res` and the runtime's framework-neutral contract (`RuntimeRequest`/`RuntimeResponse`). **All logic lives in `@personaai/runtime`. If this package grows large, something is wrong** (issue's own size expectation).

The reference for the translation is the runtime's existing, tested Node bridge: `sdk/runtime/examples/node-handler.ts` (`toNodeHandler` + `readJsonBody` + `readMultipartBody`).

---

## 2. Scope traceability (issue → plan)

| Issue scope item | Where it's covered |
|---|---|
| Express Router export | §5 (public API), §7 (implementation) |
| User resolver integration via Express middleware pattern | §8 |
| Lifecycle hook configuration | §5.3 (pass-through), §8 |
| Multipart file upload handling (integrate with Express body parsing) | §9 |
| SSE streaming via Express response | §10.2 |
| Documentation with Express-specific quickstart | §13 |
| Thin adapter (all logic in runtime) | §6 (non-goals), §14 (guardrail) |

---

## 3. Context: the runtime contract we translate to/from

All from `@personaai/runtime` v0.5.1 (do not re-read from memory — verify against these files when implementing):

**Entry point** — `sdk/runtime/src/index.ts` exports:
- `createRuntime(options)` → `Runtime = { handle(request): Promise<RuntimeResponse>; close(): void }`
- Types: `RuntimeRequest`, `RuntimeResponse`, `RuntimeMethod`, `RuntimeUploadedFile`, `CreateRuntimeOptions`, `RuntimeHooks`, `ResolveUser`, `Runtime`, `RuntimeCapabilities`

**Inbound** — `RuntimeRequest` (`sdk/runtime/src/types/request.ts`):
```ts
{
  method: RuntimeMethod;                 // 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string;                          // pathname only, may still include mountPath prefix (runtime strips it)
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: unknown;                         // parsed JSON, or form fields for multipart
  file?: RuntimeUploadedFile;            // single upload (POST /files)
  files?: RuntimeUploadedFile[];         // multi upload (POST /knowledge/:id/documents)
  userId: string | null;                 // adapter sets null; runtime fills via resolveUser
}
```

**Outbound** — `RuntimeResponse` (`sdk/runtime/src/types/response.ts`), three kinds:
```ts
{ kind: 'buffered'; status: number; headers: Record<string,string>; body: string }          // pre-serialized JSON — write verbatim
{ kind: 'stream';   status: number; headers: Record<string,string>; body: AsyncIterable<string> }      // SSE frames ("data: ...\n\n") — chat
{ kind: 'binary';   status: number; headers: Record<string,string>; body: AsyncIterable<Uint8Array> }  // file downloads
```

**Key behaviors the adapter can rely on (all already handled by the runtime):**
- `runtime.handle()` **never throws** for HTTP errors — it catches everything and returns a sanitized `buffered` error response (`sdk/runtime/src/runtime.ts` + `errors.ts`). Only *adapter-side* translation (body parsing, etc.) can throw.
- Auth is the runtime's job: it calls `resolveUser(request)` for every route except `/health`; `null`/throw → `401`. `request.userId` the adapter sets is **overwritten** by the runtime (`resolvedRequest = { ...request, userId }`).
- Mount-path stripping is **tolerant both ways** (`stripMountPath` in `sdk/runtime/src/routing.ts`): pass a mount-relative `path` with `mountPath` unset, *or* the full path with `mountPath` set — either works.
- Multipart is the **adapter's job**: the runtime never parses raw bytes. Reference implementation: `readMultipartBody` in `sdk/runtime/examples/node-handler.ts` (native undici `Request`/`FormData`, zero dependencies).
- Streaming responses arrive as already-formatted SSE frame strings (`data: <json>\n\n`, plus `: heartbeat\n\n` comment lines) — adapters just write them through. `RunDriver` emits them in order with no dupes/gaps.
- `close()` stops the internal run-eviction timer — the adapter must surface it.

---

## 4. Design decisions (with rationale)

1. **`toExpressRouter(runtime)` is the core primitive** — mirrors `toNodeHandler(runtime)` in the runtime's examples for symmetry, and supports the epic's documented pattern of mounting **two runtimes** (`appRuntime` + `adminRuntime` with different `resolveUser`/`capabilities`) at different paths. A factory that creates the runtime internally would break that pattern.
2. **A convenience factory `createExpressAdapter(options)` also ships** — the "one call" DX for the common case, returning `{ router, runtime }` (so `runtime.close()` is reachable for shutdown hooks).
3. **User resolution via the Express middleware pattern**: the factory accepts an optional `resolveUserFrom(req)` that receives the **raw Express `Request`** — the developer's own auth middleware (Clerk, Passport, JWT, session) runs *before* the mount, attaches the identity to `req` (e.g. `req.user`), and the resolver reads it. This is the issue's "user resolver integration via Express middleware pattern" made concrete.
4. **Multipart: zero-dependency native parsing** (undici `Request`/`FormData`), copied/adapted from the runtime's proven `readMultipartBody`. No `multer` dependency — keeps the adapter thin. The adapter also honors multer-parsed `req.file`/`req.files`/`req.body` if a host already used multer (integration, not dependency).
5. **Body reading is parser-aware**: if the host already mounted `express.json()`/`express.urlencoded()` (extremely common), use `req.body` instead of re-reading the stream. Neither parser consumes `multipart/form-data`, so the raw stream is always available for multipart. This is the "integrate with Express body parsing" half of the issue.
6. **`router.use(handler)` (not per-route wiring)** — the runtime owns routing (404/405 with `Allow`, param capture). The adapter registers one catch-all middleware on the router; every method and subpath under the mount flows to `runtime.handle()`.
7. **Path: pass `req.path`** (mount-relative — Express already computes it inside a mounted router) with `mountPath` unset by default. Tolerant of hosts that also set `mountPath` (see §3).
8. **Peer-depend on `express`** (`>=4` — works with both 4.x and 5.x; the repo's backend uses Express 5). The host owns Express; the adapter must not force a version.
9. **Version-lock with runtime**: dependency `@personaai/runtime: ^0.5.1`. The ecosystem plan says frontend/backend packages "version together and validate compatibility" — runtime is still `0.x`, so a caret on the same minor is the pragmatic lock for now.
10. **SSE/client-disconnect hygiene**: on `res.on('close')`, terminate the async iteration (`iterator.return()`) so `RunDriver` unsubscribes immediately — don't keep pumping to a dead socket. (The node example doesn't do this; the Express adapter should, since it's production-quality.) Apply backpressure via `res.write()` return value + `drain`.

---

## 5. Public API surface

```ts
// sdk/adapters/express/src/index.ts
import type { Runtime, CreateRuntimeOptions } from '@personaai/runtime';
import type { Request, Router } from 'express';

/** Receives the raw Express Request; returns the resolved external user id, or null → 401. */
export type ExpressResolveUser = (req: Request) => string | null | Promise<string | null>;

/** Core primitive — mirrors toNodeHandler(runtime). Runtime owns auth (its resolveUser). */
export function toExpressRouter(runtime: Runtime): Router;

/** Convenience factory. Creates the runtime internally; returns it so close() is reachable. */
export function createExpressAdapter(
  options: CreateRuntimeOptions & {
    /** Express-middleware-pattern resolver. When provided, it wins over options.resolveUser. */
    resolveUserFrom?: ExpressResolveUser;
  }
): { router: Router; runtime: Runtime };
```

### 5.1 Developer-facing usage (the whole story, ~6 lines)

```ts
import express from 'express';
import { createExpressAdapter } from '@personaai/express';

const app = express();
app.use(express.json());                      // their normal parsing — the adapter coexists
app.use('/api/persona', yourAuthMiddleware);  // their auth, e.g. Clerk/Passport — sets req.user

const persona = createExpressAdapter({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: (req) => req.user?.id ?? null,   // Express middleware pattern
  hooks: { afterRun: (ctx) => deductCredits(ctx.userId) },
});
app.use('/api/persona', persona.router);

app.listen(3000);
// shutdown: persona.runtime.close();
```

### 5.2 Two-runtime (admin surface) pattern — must keep working

```ts
app.use('/api/persona', toExpressRouter(appRuntime));       // end users
app.use('/api/admin/persona', toExpressRouter(adminRuntime)); // capabilities on, stricter resolveUser
```

### 5.3 Lifecycle hooks

No adapter logic — `hooks` is part of `CreateRuntimeOptions` and passes straight through to `createRuntime` in the factory, or the developer configures it directly on `createRuntime` when using `toExpressRouter`. The adapter never inspects or wraps hooks.

---

## 6. Non-goals (deliberately out of scope)

- **No route logic** — no HTTP methods, paths, or handlers live here. The runtime routes.
- **No auth logic** — Persona never authenticates; the adapter only hands the identity over.
- **No multipart dependency** — native parsing only; multer is honored-if-present, never required.
- **No frontend/React concerns** — that's `@personaai/react` / `@personaai/ui` (other issues/waves).
- **No `@personaai/node`** — a separate Wave 2 package; the runtime's `examples/node-handler.ts` stays there until it ships.
- **No `RunBroker`/multi-instance resume** — runtime-level, tracked in #229.
- **No NestJS/Hono/Fastify adapters** — sibling Wave 3 issues, same pattern, separate packages.

**Guardrail:** the adapter's `src/` should stay around ~150–250 lines of real logic. If it exceeds that, the design is wrong — push the logic into the runtime instead.

---

## 7. Package layout

```
sdk/adapters/express/
├── package.json            # @personaai/express, v0.1.0, tsup + vitest conventions (copy from sdk/runtime)
├── tsconfig.json           # strict, node, ES2022 (copy from sdk/runtime)
├── tsup.config.ts          # esm + cjs + dts, platform node (copy)
├── vitest.config.ts        # node env, include test/** and examples/**
├── eslint.config.js        # copy from sdk/runtime
├── .prettierrc             # copy
├── CHANGELOG.md            # 0.1.0 entry
├── README.md               # Express-specific quickstart (§13)
├── src/
│   ├── index.ts            # exports: toExpressRouter, createExpressAdapter, ExpressResolveUser
│   ├── translate.ts        # Express Request → RuntimeRequest (method/path/query/headers/body)
│   ├── multipart.ts        # native undici multipart parsing (adapted from runtime examples/node-handler.ts)
│   └── write.ts            # RuntimeResponse → Express Response (buffered / SSE stream / binary, backpressure, disconnect cleanup)
├── examples/
│   ├── express-server.ts   # runnable demo (mirrors runtime's examples/node-server.ts): createRuntime + toExpressRouter + express()
│   └── express-server.test.ts  # smoke test with a fake runtime
└── test/
    ├── helpers.ts          # makeFakeRuntime(handler): stub Runtime — no network
    ├── translate.test.ts
    ├── multipart.test.ts
    ├── router.test.ts      # buffered routes, status/headers/body fidelity, 204/405/404, mount behavior
    ├── auth.test.ts        # runtime-level resolveUser + adapter-level resolveUserFrom
    ├── streaming.test.ts   # SSE headers/flush, ordered frames, x-persona-run-id, disconnect cleanup
    └── binary.test.ts      # file download bytes
```

**Dependencies:**
- `dependencies`: `@personaai/runtime ^0.5.1`
- `peerDependencies`: `express >=4`
- `devDependencies`: `express`, `@types/express` (v5 types track Express 5; align to what the repo uses), `supertest`, `@types/supertest`, plus the usual `typescript`, `tsup`, `vitest`, `eslint`, `prettier`, `@types/node` (copy versions from `sdk/runtime/package.json`).

**Local dev wiring:** SDK packages have no root pnpm workspace. For development, point at the local runtime build: `pnpm add ../../runtime` (creates a `file:` link) so `createRuntime`/types resolve from `sdk/runtime/dist`. Before release, swap to `^0.5.1`.

---

## 8. User resolver — the Express middleware pattern

Two supported mechanisms, exactly one wins per mount:

| Mechanism | Who | How it works |
|---|---|---|
| **Runtime-level** `resolveUser(request: RuntimeRequest)` | passed to `createRuntime` | Receives the translated request (headers available: cookies, bearer tokens, `x-*`). Works with `toExpressRouter` unchanged. |
| **Adapter-level** `resolveUserFrom(req: Request)` (factory only) | passed to `createExpressAdapter` | Receives the **raw Express request** — can read `req.user`/`req.auth`/`req.session` set by the developer's own middleware. This is the issue's middleware pattern. |

**Wiring when `resolveUserFrom` is provided** (implementation detail for `createExpressAdapter`):
1. `createRuntime({ ...options, resolveUser: (r) => r.userId ?? null })` — runtime-level resolver becomes a pass-through of the pre-resolved id.
2. Before `runtime.handle(request)`, the adapter runs `request.userId = await options.resolveUserFrom(req)`.
3. Result: the developer's middleware runs first (Express order), sets `req.user`, the adapter resolves it, and the runtime treats the request as authenticated. A `null`/throw → runtime responds `401` as usual.

**Contract note:** resolution happens inside the mounted router, i.e. *after* the developer's own auth middleware — this is exactly the ordering the DX vision prescribes ("The host application says *this request is from user X*. Persona takes it from there.").

**Tests (§12)** must cover: resolver returning null → 401; resolver throwing → 401; adapter-level resolver reading `req.user` set by a preceding middleware; `/health` with no resolver → still 200.

---

## 9. Multipart file upload handling

**Problem:** Express doesn't parse multipart by default, and the runtime requires the adapter to populate `RuntimeRequest.file`/`.files` + form fields on `body`.

**Approach (zero new runtime deps)** — adapt `readMultipartBody` from `sdk/runtime/examples/node-handler.ts`:

```ts
// src/multipart.ts — roughly, copied from the runtime's reference and re-typed for Express
const request = new Request('http://internal/', {
  method: 'POST',
  headers: { 'content-type': contentType },   // carries the multipart boundary
  body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
  duplex: 'half',
} as RequestInit);
const formData = await request.formData();
// field 'file'  → { file }          (POST /files)
// field 'files' → { files[] }       (POST /knowledge/:id/documents)
// everything else → body fields     (e.g. agentId, threadId)
```

**Integration with Express body parsing (the issue's wording):**
- `express.json()` and `express.urlencoded()` **skip** `multipart/form-data` content-types (body-parser ignores non-matching types), so the raw stream is still readable when the adapter needs it. No conflict — verify with a test that mounts `app.use(express.json())` and still uploads a file.
- If the host already used `multer` (or any parser that consumed the stream and populated `req.file(s)`/`req.body`), the adapter should prefer those parsed values. Document this as the "bring your own parser" option.
- **Content-Length** is preserved on the raw stream; the native `Request` with `duplex: 'half'` handles it exactly as in the node reference.
- Guard: if the stream is already consumed (`req.readableEnded`) and `req.body`/`req.file(s)` aren't populated, respond 400 with a clear message ("multipart body already consumed by a body parser before the adapter").

**Routes affected:** `POST /files` (single `file`) and `POST /knowledge/:id/documents` (multiple `files`, `knowledge` capability). Both must be integration-tested.

---

## 10. Request/response translation

### 10.1 `translate.ts` — Express `Request` → `RuntimeRequest`

```ts
const method = (req.method ?? 'GET').toUpperCase() as RuntimeMethod;
const url = new URL(req.originalUrl, 'http://localhost');       // full URL — correct query regardless of mount
// query: url.searchParams → Record<string, string | undefined>
// headers: req.headers (Node-lowercased; arrays joined with ', ')
// path: req.path   // mount-relative (Express computed it); runtime's stripMountPath tolerates
const bodyless = method === 'GET' || method === 'DELETE';
if (!bodyless && contentType.includes('multipart/form-data'))  → parseMultipart (§9)
else if (!bodyless) body = req.body ?? await readJsonBody(req)  // use host-parsed body when present
return { method, path: req.path, headers, query, body, file, files, userId: null };
```

Notes:
- `req.body ?? readJsonBody(req)` covers both "host already mounted `express.json()`" (use `req.body`) and "no parser" (read the stream ourselves). A `req.body` of `undefined` falls through to stream reading; an empty `{}` is fine to pass through.
- Malformed JSON when *we* parse → throw a translation error → respond `400 INVALID_REQUEST` (runtime envelope shape) rather than letting Express 4 crash.
- **HEAD:** `router.use` catches HEAD; the runtime will 405 it (HEAD isn't a `RuntimeMethod`). Acceptable and documented; optionally map `HEAD → GET` in a follow-up if consumers ask.

### 10.2 `write.ts` — `RuntimeResponse` → Express `Response`

```ts
res.status(response.status);
for (const [k, v] of Object.entries(response.headers)) res.set(k, v);

if (response.kind === 'buffered') { res.end(response.body); return; }   // body is pre-serialized — end(), never res.send() re-serialization

res.flushHeaders();                                  // commit SSE/binary headers immediately
const iterator = response.body[Symbol.asyncIterator]();
const onClose = () => { void iterator.return?.(); }; // client gone → unsubscribe from RunDriver
res.on('close', onClose);
try {
  for await (const chunk of response.body) {
    if (!res.write(chunk)) await new Promise<void>((r) => res.once('drain', r));  // backpressure
  }
  res.end();
} finally {
  res.off('close', onClose);
}
```

- **stream** chunks are `string` SSE frames (`data: ...\n\n`, heartbeat `: heartbeat\n\n`) — write verbatim. `res.write(string)` is fine.
- **binary** chunks are `Uint8Array` — `res.write` accepts them directly; Express sets `Transfer-Encoding: chunked` when no `content-length` is forwarded (the runtime doesn't set one for streams).
- Headers to forward verbatim: `content-type`, `content-length` (buffered only), `x-persona-run-id` (chat — the reconnect contract!), `Allow` (405). **Never re-derive or strip them.**
- `buffered` responses include 204 (empty body — `res.end()` handles) and all error envelopes — no special-casing needed.
- Guard against double-`end()` on early client disconnect (wrap `res.end()` so a `close` racing the final write can't throw).

---

## 11. Error handling

| Source | Handling |
|---|---|
| `runtime.handle()` | Never throws for HTTP errors — returns a sanitized buffered error (`{error:{code,message,detail?}}`). Forward verbatim. |
| Translation (body parse, consumed stream) | Catch → `400 INVALID_REQUEST` JSON in the same envelope shape. |
| `resolveUser` throw | Runtime catches → `401` (runtime behavior, no adapter code). |
| Unexpected adapter bug | Catch → `next(err)` so the host's error middleware handles it (Express 5 auto-forwards rejected handlers; the explicit try/catch keeps Express 4 safe). |

The adapter should be *quieter* than the runtime: it forwards, it doesn't interpret.

---

## 12. Testing plan (vitest — same harness as `sdk/runtime`)

**Harness:** `test/helpers.ts` exports `makeFakeRuntime(handler)` returning a stub `Runtime` whose `handle()` returns canned `RuntimeResponse`s — **no network, no real Persona API** anywhere in the adapter tests. Integration with the real runtime happens once, in `examples/express-server.test.ts`, by building `createRuntime({ fetch: fakeFetch })` (the runtime's `fetch` override is designed for exactly this).

**Buffered routes** (`router.test.ts`): mount `toExpressRouter(fakeRuntime)` in a real `express()` app; use **supertest** for buffered assertions — status, exact headers, exact body bytes, `204` no-body, `405` `Allow` header passthrough, `404` unknown route, mount-relative paths (`/api/persona/threads` → runtime sees `/threads`).

**SSE** (`streaming.test.ts`): supertest's response streaming is awkward — use `http.createServer(app).listen(0)` + native `fetch` instead. Assert: headers + `x-persona-run-id` present before first frame, frames arrive in order with exact `data: ...\n\n` formatting, heartbeat lines pass through, and **client disconnect triggers `iterator.return()`** on the fake runtime's stream (assert the fake's generator `finally` block ran).

**Binary** (`binary.test.ts`): live server + fetch; assert bytes and `content-type`.

**Auth** (`auth.test.ts`): runtime-level `resolveUser` (null → 401, string → pass-through); adapter-level `resolveUserFrom` reading `req.user` set by a preceding `(req,res,next) => { req.user = {...}; next(); }` middleware; throwing resolver → 401; `/health` 200 without auth.

**Multipart** (`multipart.test.ts`): native `fetch` + `FormData` against a live app — single `file` (POST /files), multi `files` (POST /knowledge/:id/documents), form fields land on `body`, boundary/content-type forwarding; and a second app with `app.use(express.json())` mounted to prove coexistence.

**Translation** (`translate.test.ts`): method/path/query/headers fidelity; `req.body` used when `express.json()` ran vs raw-stream read when it didn't; malformed JSON → 400; bodyless GET/DELETE.

**Run**: `pnpm test` (vitest), plus `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` — all four must pass (same scripts as `sdk/runtime/package.json`).

---

## 13. Documentation plan

1. **`sdk/adapters/express/README.md`** — Express-specific quickstart: install, mount, resolver (both patterns), hooks pass-through, multipart notes (multer coexistence + native), error envelope, reconnect/resume (`x-persona-run-id`), routes table **linking to the runtime README** (single source of truth), the two-runtime admin pattern.
2. **Update `sdk/typescript/README.md`** (the "current Express recipe" the issue says this package eliminates — lines ~114–129): replace the manual boilerplate section with a pointer to `@personaai/express`.
3. **Update `sdk/runtime/README.md`** — "Not yet implemented" lists "Any published framework adapter ... — by design, not a gap". Once `@personaai/express` ships, that bullet needs rewording (express exists; others remain).
4. **Update `AGENTS.md`** — SDK directory tree: `adapters/` is no longer `# future`; add `express`.
5. **Update `product-research/11-sdk-new/package-ecosystem.md`** — Wave 3 table: mark `@personaai/express` shipped (hygiene; keeps the plan doc truthful).
6. **`developer-docs/`** (Mintlify) — the full Express Adapter reference group now lives at
   `developer-docs/guides/express/` (quickstart, routes, auth, uploads, streaming), registered as
   the "Express Adapter" group in `docs.json` under the Guides tab.
7. **`CHANGELOG.md`** — `0.1.0` entry per repo convention.

---

## 14. Implementation steps (ordered)

1. **Scaffold** `sdk/adapters/express/` — copy `package.json` scripts/tsup/vitest/eslint/prettier/tsconfig conventions from `sdk/runtime`; set name/version/peer deps; `pnpm install` with a `file:` link to the local runtime build.
2. **`src/translate.ts`** — Express `Request` → `RuntimeRequest` (§10.1).
3. **`src/multipart.ts`** — native multipart parsing, adapted from the runtime's reference (§9).
4. **`src/write.ts`** — response writer with buffered/stream/binary + backpressure + disconnect cleanup (§10.2).
5. **`src/toExpressRouter.ts`** — core adapter: `router.use(handler)` catch-all, translation, `runtime.handle()`, response write, try/catch → `next(err)`.
6. **`src/index.ts`** — exports + `createExpressAdapter` factory with `resolveUserFrom` wiring (§5, §8).
7. **Tests** — helpers + the six suites in §12.
8. **`examples/express-server.ts` + test** — runnable demo mirroring `sdk/runtime/examples/node-server.ts`.
9. **README + CHANGELOG** (§13.1, §13.7).
10. **Docs sync** (§13.2–13.6) — the four repo files + developer-docs quickstart.
11. **Verify** — `typecheck`, `lint`, `format:check`, `test`, `build`, and `npm pack --dry-run` to confirm the published artifact contains only `dist/` + README.
12. **Release** — `npm publish` (publishing is manual today — no workflow exists in `.github/workflows`; confirm with the maintainer and record the version bump in the ecosystem docs).

---

## 15. Risks & open questions

| Item | Risk / question | Mitigation / decision |
|---|---|---|
| Express 4 vs 5 | `req.query` typing, async-error auto-forwarding differ | Peer range `>=4`; explicit try/catch in the handler; pin `@types/express` to match the version used in tests. |
| Resolver precedence | `resolveUserFrom` vs `resolveUser` both set | Documented rule: `resolveUserFrom` wins when provided (it's the Express-native path). |
| Body consumed by host parser | Multipart stream gone → silent 400s | Explicit guard + clear error message (§9); README guidance. |
| `content-length` on streams | Express may set its own | Forward runtime headers verbatim; runtime doesn't set content-length for streams; test asserts chunked behavior. |
| Version lock policy | `^0.5.1` vs exact match between adapter and runtime | Caret on the same minor while both are `0.x`; revisit when the ecosystem settles (epic's "version together" goal). |
| HEAD/OPTIONS | `router.use` forwards them; runtime 405s | Document as known behavior; optional HEAD→GET mapping as a follow-up. |
| Publish flow | Manual today | Confirm with maintainer before the release step; nothing automated to update. |

---

## 16. Definition of done (acceptance criteria)

- [ ] `pnpm --dir sdk/adapters/express typecheck && lint && test && build` all pass (no `eslint-disable`, no `@ts-ignore`).
- [ ] A developer can mount with `app.use('/api/persona', toExpressRouter(runtime))` and chat streams over SSE with `x-persona-run-id` reconnect working.
- [ ] Both resolver patterns work and are tested (runtime-level + Express-middleware `resolveUserFrom`).
- [ ] All eight lifecycle hooks pass through unchanged (config-only, no adapter code).
- [ ] `POST /files` and `POST /knowledge/:id/documents` multipart uploads work with **and without** `express.json()` mounted; multer-parsed input is honored if present.
- [ ] Client disconnect tears down the runtime subscription (no zombie pumps) — tested.
- [ ] Adapter `src/` stays thin (≈150–250 lines of real logic); everything else lives in the runtime.
- [ ] Express-specific quickstart ships in the package README **and** `developer-docs/`; `sdk/typescript/README.md` boilerplate section replaced with a pointer.
- [ ] Runtime README "Not yet implemented" and AGENTS.md `adapters/` tree updated.
- [ ] `npm pack --dry-run` output contains only `dist/`, `README.md`, `package.json` (and LICENSE if we add one).
