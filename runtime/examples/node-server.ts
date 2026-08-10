/**
 * Runnable demo: `createRuntime` + `toNodeHandler` + `http.createServer`.
 *
 * Run with real Persona credentials:
 *   PERSONA_BASE_URL=https://api.persona.hasanraiyan.me PERSONA_CREDENTIAL=... npx tsx examples/node-server.ts
 *
 * There is no real auth provider in this repo to demo against, so
 * `resolveUser` here is a deliberately trivial stand-in: it trusts an
 * `x-demo-user-id` header outright. A real integration replaces this with a
 * call to whatever the host application actually uses (Clerk, a JWT, a
 * session cookie, ...).
 */
import { createServer } from 'node:http';
import { createRuntime } from '../src/index.js';
import { toNodeHandler } from './node-handler.js';

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
createServer(toNodeHandler(runtime)).listen(port, () => {
  console.log(`@personaai/runtime demo listening on http://localhost:${port}`);
});
