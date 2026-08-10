import type { RuntimeRequest } from './request.js';
import type { RuntimeResponse } from './response.js';
import type { RuntimeHooks } from './hooks.js';

/**
 * The single point of contact between the host's auth world and the
 * runtime's world. Receives the inbound request (with `userId: null`) and
 * returns the resolved external user id, or `null`/a thrown error if the
 * request isn't authenticated — either way the runtime responds 401.
 * Persona never authenticates users; this function is entirely the host's.
 */
export type ResolveUser = (request: RuntimeRequest) => string | null | Promise<string | null>;

export interface CreateRuntimeOptions {
  /** Base URL of the Persona Developer Platform API, e.g. "https://api.persona.hasanraiyan.me". */
  baseUrl: string;
  /** Project credential, shaped "<keyId>.<secret>" — never expose this to a browser. */
  credential: string;
  resolveUser: ResolveUser;
  hooks?: RuntimeHooks;
  /** Prefix to strip from `request.path` before routing, e.g. '/api/persona'. @default '' (no stripping) */
  mountPath?: string;
  /**
   * 'development' includes error detail (message/stack/upstream response)
   * in error responses; 'production' hides it behind a generic message.
   * @default 'production', unless `process.env.NODE_ENV === 'development'`.
   */
  mode?: 'development' | 'production';
  /** Override fetch (proxying, tracing, or test injection). Forwarded to every per-request PersonaClient. */
  fetch?: typeof fetch;
  /**
   * How often to send an SSE comment-line heartbeat (`: heartbeat\n\n`)
   * during a gap in the `/chat` stream — e.g. a long-running tool call with
   * no token output — so intermediary proxies/load balancers with an idle
   * timeout don't kill the connection. Comment lines are invisible to any
   * `data:`-only SSE parser (including `@personaai/sdk`'s own), so this
   * never changes the AG-UI event sequence a consumer sees.
   * @default 15000
   */
  heartbeatIntervalMs?: number;
  /**
   * How long a finished `/chat` run stays resumable via `GET /chat/:runId/resume`
   * before an internal eviction sweep removes it.
   * @default 300000 (5 minutes)
   */
  runGraceMs?: number;
  /**
   * Safety valve on the in-memory resumable-run registry — once over this
   * many tracked runs, the oldest-finished ones are evicted first (still
   * in-flight runs are never evicted by this cap).
   * @default 1000
   */
  maxTrackedRuns?: number;
}

export interface Runtime {
  handle(request: RuntimeRequest): Promise<RuntimeResponse>;
  /**
   * Stops the background eviction timer used for resumable-run bookkeeping.
   * The timer is `unref`'d and won't itself keep a Node process alive, so
   * calling this is optional — but do call it if you `createRuntime()`
   * repeatedly in a long-lived process (e.g. per-test-suite setup) to avoid
   * accumulating timers.
   */
  close(): void;
}
