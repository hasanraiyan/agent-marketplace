# @personaai/express

Express adapter for the [Persona](https://persona.hasanraiyan.me) runtime — exposes
`@personaai/runtime` as an Express Router, so you mount the entire runtime surface (AG-UI chat
streaming, threads, files, memory, MCP OAuth, health) with one line. No stream forwarding, no
AG-UI parsing, no thread CRUD endpoints, no upload proxying — that plumbing lives in the runtime,
and this package is just the translation layer between Express `req`/`res` and the runtime's
framework-neutral contract.

**Server-side only.** The credential this adapter forwards is a server-side secret — never bundle
this into a browser app.

**v0.1.0 — published.** Full documentation: the [Express Adapter guides](https://persona.hasanraiyan.me/guides/express/quickstart)
(quickstart, routes, auth, uploads, streaming).

## Install

```
npm install @personaai/express
```

Peer-dependency on `express >= 4` (Express 5 and 4 both supported).

## Quickstart

### 1. Create the runtime and mount it

```ts
import express from 'express';
import { createRuntime } from '@personaai/runtime';
import { toExpressRouter } from '@personaai/express';

const runtime = createRuntime({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!, // "<keyId>.<secret>"
  resolveUser: (request) => getUserIdFromSession(request.headers['cookie']), // your auth, your rules
});

const app = express();
app.use(express.json()); // your normal parsing — the adapter coexists with it
app.use('/api/persona', toExpressRouter(runtime));

app.listen(3000);
```

That's the whole backend. The runtime surface now lives at `/api/persona/*` — `POST /chat` (SSE),
`GET/POST /threads`, `GET/POST /files`, `/memory/*`, MCP OAuth callbacks, `GET /health`, and the
opt-in admin routes — see [the Express routes reference](https://persona.hasanraiyan.me/guides/express/routes).

### 2. Wire your auth with the Express middleware pattern

Persona never authenticates users. Two ways to tell the runtime who a request is from:

**Runtime-level resolver** (above): receives the translated request; read cookies/headers however
you like.

**Adapter-level resolver** — for the Express-middleware pattern, where your own auth middleware
(e.g. Clerk, Passport, a JWT check) runs *before* the adapter and attaches the identity to `req`:

```ts
import { createExpressAdapter } from '@personaai/express';

const persona = createExpressAdapter({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: (req) => req.user?.id ?? null, // whatever your middleware attached
  hooks: {
    afterRun: (ctx) => deductCredits(ctx.userId), // your business logic
  },
});

app.use('/api/persona', yourAuthMiddleware); // sets req.user
app.use('/api/persona', persona.router);

// shutdown: persona.runtime.close() stops the runtime's background timers
```

A resolver returning `null` (or throwing) makes the runtime respond `401` — every route except
`GET /health` requires an authenticated user.

### 3. Lifecycle hooks

All eight hooks (`beforeRun`, `afterRun`, `onError`, `beforeToolCall`, `afterToolCall`,
`onFileUpload`, `onThreadCreate`, `onMemoryWrite`) pass straight through to the runtime — configure
them on `createRuntime` (or in the factory options above). The adapter never inspects them.

## What the adapter handles for you

| Concern | How |
| --- | --- |
| **Routing** | One catch-all middleware → `runtime.handle()`. The runtime owns matching, params, and 404/405 (with `Allow`). |
| **JSON bodies** | Uses `req.body` when a host body parser already ran, else reads + parses the raw stream itself. |
| **Multipart uploads** | `POST /files` (`file` part) and `POST /knowledge/:id/documents` (`files` parts) are parsed natively via Node's `FormData` — zero extra dependencies. If you use `multer` yourself, already-parsed `req.file`/`req.files` are honored. |
| **SSE streaming** | Headers are flushed immediately, frames are written verbatim (`data: ...\n\n`, plus `: heartbeat` comment lines), with `drain`-based backpressure. |
| **File downloads** | Binary responses stream through chunk by chunk. |
| **Reconnect** | The chat `x-persona-run-id` header and `GET /chat/:runId/resume` just work — see the [Express streaming reference](https://persona.hasanraiyan.me/guides/express/streaming). |
| **Disconnects** | When a client hangs up mid-stream, the adapter unsubscribes from the runtime immediately — no zombie pumps. |
| **Errors** | Runtime responses (including sanitized error envelopes `{"error":{code,message}}`) are forwarded verbatim. Adapter translation failures (e.g. malformed JSON or an unparsable multipart body) respond `400 INVALID_REQUEST` in the same envelope. |

**Body size:** like the runtime's own reference bridge, the adapter buffers request bodies (JSON
and multipart) in memory with no size limit — enforce one with your own middleware if you need it
(e.g. `express.json({ limit: '10mb' })` or an `express.raw()` guard before the mount).

## Two runtimes, two mounts (admin surface)

The runtime's admin routes (providers, skills, knowledge, stores, audit logs, architect, agent
CRUD) are off by default. To expose them, mount a second runtime with stricter auth:

```ts
app.use('/api/persona', toExpressRouter(appRuntime));          // end users
app.use('/api/admin/persona', toExpressRouter(adminRuntime));  // capabilities on, stricter resolveUser
```

See the [runtime's capabilities docs](https://persona.hasanraiyan.me/guides/runtime/capabilities)
for the security reasoning.

## API

```ts
// Core primitive — mirrors @personaai/runtime's toNodeHandler. The runtime owns auth.
toExpressRouter(runtime: Runtime, resolveUserFrom?: ExpressResolveUser): Router

// Convenience factory — creates the runtime internally.
createExpressAdapter(options: CreateRuntimeOptions & { resolveUserFrom?: ExpressResolveUser }): {
  router: Router;
  runtime: Runtime;
}

type ExpressResolveUser = (req: Request) => string | null | Promise<string | null>;
```

## Development

```
pnpm install
pnpm test         # vitest — fake-runtime harness, no network
pnpm typecheck    # tsc --noEmit
pnpm lint
pnpm build        # tsup → dist/ (ESM + CJS + d.ts)
```

**Development note:** `@personaai/runtime` is a registry dependency (`^0.5.1`) — no local build of
`sdk/runtime` is required. If you iterate on the runtime itself, point the dependency at a local
`file:` link temporarily; a `prepublishOnly` guard refuses to publish while a `file:` link is in
place.

**Express compatibility:** the peer range accepts `express >= 4`. The default suite runs against
Express 5; a dedicated Express 4 suite at `compat/express4/` mounts the built package on a real
`express@4` app and is run with `pnpm test:express4`.

## License

MIT
