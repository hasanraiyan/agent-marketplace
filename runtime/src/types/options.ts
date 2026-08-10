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
}

export interface Runtime {
  handle(request: RuntimeRequest): Promise<RuntimeResponse>;
}
