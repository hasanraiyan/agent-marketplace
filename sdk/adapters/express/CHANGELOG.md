# Changelog

## 0.1.2 — 2026-09-03

- **Built-in logging** — OFF by default, selectable per instance via `logLevel` / `logger` on `createExpressAdapter` (forwarded to `createRuntime`) and optionally on `toExpressRouter(runtime, resolveUserFrom, { logLevel, logger })`. Uses `createLogger('adapter:express')` with child namespaces `adapter:express:translate`, `adapter:express:multipart`, `adapter:express:write`, `adapter:express:router`, `adapter:express:factory`. Every level visible: `off < error < warn < info < debug < trace`. Secrets (credentials, `Authorization` header) are never logged. Bump `@personaai/runtime` to `^0.5.3` to consume its new logger.

## 0.1.1 — 2026-08-15

- Patch: align dependency ranges and docs after runtime 0.5.2 release (no API change).

## 0.1.0 — 2026-08-10

First release of `@personaai/express` — the Express adapter for `@personaai/runtime` (Wave 3 —
Framework Expansion, epic #227, issue #228).

- **Express Router export** — `toExpressRouter(runtime)` mounts the whole runtime surface via
  `app.use('/api/persona', ...)`; `createExpressAdapter(options)` factory returns `{ router, runtime }`.
- **User resolver via the Express middleware pattern** — optional `resolveUserFrom(req)` reads the
  identity the host's own auth middleware attached to `req`; the runtime-level `resolveUser`
  contract is preserved.
- **Lifecycle hooks pass-through** — all eight runtime hooks flow through unchanged.
- **Multipart file uploads** — `POST /files` (single `file`) and `POST /knowledge/:id/documents`
  (multi `files`) parsed natively via Node's `Request`/`FormData` (no extra dependency); multer-
  parsed `req.file`/`req.files` are honored if a host already used multer; coexists with
  `express.json()`.
- **SSE streaming** — headers flushed immediately, frames forwarded verbatim, `drain`-based
  backpressure, and client-disconnect tears down the runtime subscription.
- **Binary responses** — file downloads stream through chunk by chunk.
- **Error handling** — runtime responses (incl. sanitized envelopes) forwarded verbatim; adapter
  translation failures respond `400 INVALID_REQUEST` in the same envelope.
- Tests (26) with a fake-runtime harness — no network; example app + smoke test.
- Express 4 compatibility suite (`compat/express4/`, run via `pnpm test:express4`) backs the
  `express >= 4` peer range by mounting the built package on a real `express@4` app.
- **Documentation** — full Express Adapter reference group in the developer docs (quickstart,
  routes, auth, uploads, streaming), and the runtime docs updated to point at the shipped adapter.
