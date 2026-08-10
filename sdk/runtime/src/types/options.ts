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

/**
 * Every one of these is `false` unless explicitly enabled — always-off by
 * default so upgrading this package never silently exposes new surface to
 * whoever `resolveUser` accepts. These resources are Project-level
 * configuration (LLM provider credentials, skill/knowledge-base/vector-store
 * management, security audit logs, an agent-building co-pilot) rather than
 * things an end user does in a chat session — most hosts should manage them
 * via `@personaai/sdk` directly from their own admin surface and never turn
 * these on. Turn one on only if you specifically want it reachable through
 * whatever `resolveUser` gates (which may not be "any logged-in end user" —
 * that's your call).
 */
export interface RuntimeCapabilities {
  /** Full Agent CRUD (create/get/update/delete/bulk-delete) beyond the always-on read-only `GET /agents` list. @default false */
  agentsWrite?: boolean;
  /** Full MCP server CRUD + testConnection/readResource/callTool, beyond the always-on `/mcps/:id/oauth/*` routes. @default false */
  mcps?: boolean;
  /** LLM provider configuration — **holds API keys**. @default false */
  providers?: boolean;
  /** Skill authoring. @default false */
  skills?: boolean;
  /** Knowledge base CRUD, document upload/search. @default false */
  knowledge?: boolean;
  /** Vector store CRUD and file read/write. @default false */
  stores?: boolean;
  /** Security/compliance audit log read access. @default false */
  auditLogs?: boolean;
  /** The Architect co-pilot — builds/edits Agents on the caller's behalf via tool calls. @default false */
  architect?: boolean;
}

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
  /** Opt-in switches for Project-level admin surface. See {@link RuntimeCapabilities} — everything defaults to off. */
  capabilities?: RuntimeCapabilities;
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
