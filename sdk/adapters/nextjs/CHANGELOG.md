# Changelog

## 0.1.8 — 2026-09-05

- Bump `@personaai/react` to `^0.7.3` so the client-side re-export carries the `useVoice()`
  transcript fix — an agent answer that Gemini emits as several turn-complete finals (e.g. split by a
  mid-answer tool call) now renders as one transcript line until a user line intervenes (no adapter
  code change — generic passthrough).

## 0.1.7 — 2026-09-05

- Bump `@personaai/react` to `^0.7.2` so the client-side re-export carries the `useVoice()`
  transcript fix — an agent utterance streamed by Gemini Live as several output-transcription
  fragments now renders as one transcript line instead of one bubble per fragment (no adapter
  code change — generic passthrough).

## 0.1.4 — 2026-09-05

- Bump `@personaai/runtime` to `^0.7.0` to pick up the new `POST /voice/sessions` route (no adapter code change — this is a generic passthrough).
- Bump `@personaai/react` to `^0.7.0` so the client-side re-export's new `useVoice()` hook is available.

## 0.1.3 — 2026-09-04

- Bump `@personaai/runtime` to `^0.6.0` to pick up the new `POST /threads/:id/reset` route (no adapter code change — this is a generic passthrough).
- Bump `@personaai/react` to `^0.6.0` so the client-side re-export's `useThreads()` carries the new `resetThread(threadId)` too.

## 0.1.2 — 2026-09-03

- Bump `@personaai/runtime` to `^0.5.4` (via `@personaai/sdk@^0.4.5` → `@personaai/logger@^0.1.0`).

## 0.1.1

- Built-in logging — OFF by default, selectable via `logLevel`/`logger` on `createPersonaHandler` and `toNextRouteHandlers` (child namespaces `adapter:nextjs`, `adapter:nextjs:translate`, `adapter:nextjs:write`, `runtime`, `runtime:sdk`). Server entry logs translate/write/runtime handle; client entry re-exports `@personaai/react@^0.5.4` logging via `@personaai/logger`. Nothing logs unless caller opts in; secrets redacted.

## 0.1.0 — 2026-09-01

First release of `@personaai/nextjs` — the Next.js hero package for `@personaai/runtime`
(Wave 2 — Hero Path, epic #227, issue #232).

- **App Router catch-all route handlers** — `createPersonaHandler(options)` returns
  `{ GET, POST, PUT, PATCH, DELETE, runtime }` for a single
  `app/api/persona/[...persona]/route.ts`; `toNextRouteHandlers(runtime, options)` is the
  lower-level primitive for mounting an existing runtime (e.g. a second, admin one).
- **Single install** — the root entry re-exports all of `@personaai/react` behind a `'use client'`
  boundary, so `<PersonaProvider>` drops into a server `layout.tsx` with no wrapper file and hooks
  import from the same package as the route handler. Server code lives at
  `@personaai/nextjs/server`, keeping the Project credential out of any client bundle by
  construction.
- **User resolver** — `resolveUserFrom(req)` receives the Web `Request` so it can call your auth
  library directly (Clerk's `auth()`, NextAuth, Supabase); the runtime-level `resolveUser`
  contract is preserved as an alternative. A throwing resolver means "not authenticated" → `401`.
- **Lifecycle hooks pass-through** — all eight runtime hooks flow through unchanged.
- **Path resolution from the catch-all segments** — mount the route anywhere, name the segment
  anything; segments are re-encoded so the runtime's own param decoding stays lossless. Falls back
  to the pathname (with the runtime's `mountPath` stripping) for non-catch-all mounts.
- **SSE streaming** — the runtime's async iterable becomes a pull-based `ReadableStream`, so
  backpressure is the platform's; `cancel()` on client disconnect tears the runtime subscription
  down. `X-Accel-Buffering: no` is added so a proxy in front of Next doesn't buffer the stream.
- **Multipart uploads** — `POST /files` (single `file`) and `POST /knowledge/:id/documents`
  (multi `files`) parsed with the platform's own `Request.formData()`, zero dependencies.
- **Binary responses** — file downloads stream through chunk by chunk.
- **Edge-compatible** — Web-standard APIs only; the built server entry imports nothing from
  `node:*`, and a test guards that.
- **Error handling** — runtime responses (incl. sanitized envelopes) are forwarded verbatim;
  adapter translation failures respond `400 INVALID_REQUEST` in the same envelope shape.
- Tests (35) with a fake-runtime harness plus a real-runtime chat stream over a stubbed upstream —
  no network. Runnable App Router example under `examples/`.
- **Documentation** — full Next.js Adapter reference group in the developer docs (quickstart,
  routes, auth, uploads, streaming).
