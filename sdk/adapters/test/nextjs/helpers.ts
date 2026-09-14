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

/**
 * The `{ params }` argument Next.js passes to a catch-all route handler.
 * Next 15 makes `params` a Promise; `asPromise: false` produces the Next 14
 * shape so both are covered.
 */
export function routeContext(segments: string[], asPromise = true) {
  const params = { persona: segments };
  return { params: asPromise ? Promise.resolve(params) : params };
}

export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}
