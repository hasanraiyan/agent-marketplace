export type RuntimeMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A single uploaded file — present on `RuntimeRequest.file` for a multipart `POST /files`. */
export interface RuntimeUploadedFile {
  filename: string;
  content: Uint8Array;
  contentType?: string;
}

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
  /**
   * Already-parsed JSON body, or `undefined` for bodyless requests. For a
   * multipart request (`POST /files`), this holds the non-file form fields
   * (e.g. `{ agentId, threadId }`) — the file itself is on `file`, not here.
   * Parsing raw bytes is the adapter's job either way.
   */
  body: unknown;
  /** The uploaded file, for a multipart `POST /files` request only. */
  file?: RuntimeUploadedFile;
  /**
   * The resolved external user id. Always `null` on the request the host
   * constructs — the runtime fills this in via `resolveUser` before an
   * auth-required route handler sees it.
   */
  userId: string | null;
}
