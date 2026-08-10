import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Runtime, RuntimeMethod, RuntimeRequest } from '../src/index.js';

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) return undefined;
  return JSON.parse(text);
}

export async function toRuntimeRequest(req: IncomingMessage): Promise<RuntimeRequest> {
  // Any method the runtime doesn't recognize (PUT/HEAD/OPTIONS/...) simply
  // won't match a route pattern — its own routing 404s/405s it, no need to
  // filter here.
  const method = (req.method ?? 'GET').toUpperCase() as RuntimeMethod;

  const url = new URL(req.url ?? '/', 'http://localhost');
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) query[key] = value;

  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  const body = method === 'GET' || method === 'DELETE' ? undefined : await readBody(req);

  return {
    method,
    path: url.pathname,
    headers,
    query,
    body,
    userId: null,
  };
}

/**
 * Bridges Node's raw `http` request/response to the runtime's
 * framework-neutral contract. This is a session smoke-test helper, NOT the
 * real `@personaai/node` package (a separate, future, published package) —
 * see the README for why it deliberately lives here instead of `src/`.
 */
export function toNodeHandler(runtime: Runtime) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const request = await toRuntimeRequest(req);
    const response = await runtime.handle(request);

    res.writeHead(response.status, response.headers);

    if (response.kind === 'buffered') {
      res.end(response.body);
      return;
    }

    for await (const chunk of response.body) {
      const canContinue = res.write(chunk);
      if (!canContinue) {
        await new Promise<void>((resolve) => res.once('drain', resolve));
      }
    }
    res.end();
  };
}
