export type RuntimeMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Framework-neutral inbound request. A framework adapter (Express, Node
 * `http`, ...) translates its own request object into this shape and calls
 * `Runtime.handle()` — the runtime never imports a framework.
 */
export interface RuntimeRequest {
  method: RuntimeMethod;
  /** Pathname only (no query string). May still include the `mountPath` prefix — the runtime strips it. */
  path: string;
  /** Header names as the adapter received them (Node's `http` already lowercases these). */
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  /** Already-parsed JSON body, or `undefined` for bodyless requests. Parsing raw bytes is the adapter's job. */
  body: unknown;
  /**
   * The resolved external user id. Always `null` on the request the host
   * constructs — the runtime fills this in via `resolveUser` before an
   * auth-required route handler sees it.
   */
  userId: string | null;
}
