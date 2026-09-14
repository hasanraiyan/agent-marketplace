import express from 'express';
import type { Router } from 'express';
import type { Server } from 'node:http';
import type { Runtime, RuntimeRequest, RuntimeResponse } from '@personaai/runtime';

export interface FakeRuntime extends Runtime {
  requests: RuntimeRequest[];
  closed: boolean;
}

/**
 * A stub `Runtime` — no network, no real Persona API. Tests assert on the
 * translated `RuntimeRequest`s and control the exact `RuntimeResponse`s.
 */
export function makeFakeRuntime(
  handler: (request: RuntimeRequest) => Promise<RuntimeResponse>
): FakeRuntime {
  const requests: RuntimeRequest[] = [];
  return {
    requests,
    closed: false,
    async handle(request: RuntimeRequest): Promise<RuntimeResponse> {
      requests.push(request);
      return handler(request);
    },
    close(): void {
      this.closed = true;
    },
  };
}

export function buffered(
  status: number,
  body: string,
  headers: Record<string, string> = {}
): RuntimeResponse {
  return { kind: 'buffered', status, headers, body };
}

export function okJson(value: unknown): RuntimeResponse {
  return buffered(200, JSON.stringify(value), { 'content-type': 'application/json' });
}

/** Mounts the adapter at /api/persona the way a real Express host would. */
export function createTestApp(router: Router, opts: { json?: boolean } = {}): express.Express {
  const app = express();
  if (opts.json !== false) app.use(express.json());
  app.use('/api/persona', router);
  return app;
}

export function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

export async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}
