/**
 * Runnable demo: `createRuntime` + `toExpressRouter` + `express()`.
 *
 * Run with real Persona credentials:
 *   PERSONA_BASE_URL=https://api.persona.hasanraiyan.me PERSONA_CREDENTIAL=... npx tsx examples/express-server.ts
 *
 * There is no real auth provider in this repo to demo against, so `resolveUser`
 * here trusts an `x-demo-user-id` header outright — the same stand-in the
 * runtime's own `examples/node-server.ts` uses. A real integration replaces it
 * with the host's auth (Clerk, a JWT, a session cookie, ...).
 */
import express from 'express';
import { createRuntime } from '@personaai/runtime';
import type { Runtime } from '@personaai/runtime';
import { pathToFileURL } from 'node:url';
import { toExpressRouter } from '../src/index.js';

/** The exact shape a real Express host mounts — reused by the example's test. */
export function createExpressApp(runtime: Runtime): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/persona', toExpressRouter(runtime));
  return app;
}

function main(): void {
  const runtime = createRuntime({
    baseUrl: process.env.PERSONA_BASE_URL ?? 'https://api.persona.hasanraiyan.me',
    credential: process.env.PERSONA_CREDENTIAL ?? '',
    resolveUser: (request) => request.headers['x-demo-user-id'] ?? null,
    hooks: {
      beforeRun: (ctx) => {
        console.log('[demo] beforeRun', ctx.userId, ctx.agentId);
      },
      afterRun: (ctx, result) => {
        console.log('[demo] afterRun', ctx.userId, `${result.eventCount} events`);
      },
      onError: (ctx, err) => {
        console.error('[demo] onError', ctx.phase, err);
      },
    },
  });

  const port = Number(process.env.PORT ?? 3210);
  createExpressApp(runtime).listen(port, () => {
    console.log(`@personaai/express demo listening on http://localhost:${port}`);
  });
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
