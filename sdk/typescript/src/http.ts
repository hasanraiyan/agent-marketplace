import { errorFromResponse, PersonaApiError } from './errors.js';

export interface HttpClientOptions {
  /** Base URL of the Persona Developer Platform API, e.g. "https://api.persona.hasanraiyan.me". */
  baseUrl: string;
  /** Project credential, shaped "<keyId>.<secret>" — never expose this to a browser. */
  credential: string;
  /**
   * Asserts this call acts on behalf of one of your own end users
   * (sent as `x-persona-external-user-id`). Omit for Project-level
   * (control-plane) calls. See the Integration Guide for when to use which.
   */
  externalUserId?: string;
  /** Override the fetch implementation (mainly for tests). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Maximum number of retries on 429 responses. Defaults to 2. */
  maxRetries?: number;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  /** A plain object is JSON-serialized; a FormData instance is sent as-is (multipart). */
  body?: unknown;
  headers?: Record<string, string>;
  /** Externally-provided AbortSignal (e.g. for streaming/cancellable calls). */
  signal?: AbortSignal;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  message?: string;
  code?: string;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

/**
 * Thin fetch wrapper: injects auth headers, serializes the body, parses the
 * `{success, data}` / `{success:false, message, code}` envelope, and throws
 * a typed `PersonaApiError` on failure. Retries 429s using the API's own
 * `Retry-After` header.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly credential: string;
  private readonly externalUserId: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;

  constructor(options: HttpClientOptions) {
    if (!options.baseUrl) throw new Error('HttpClient: "baseUrl" is required');
    if (!options.credential) throw new Error('HttpClient: "credential" is required');

    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.credential = options.credential;
    this.externalUserId = options.externalUserId;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.maxRetries = options.maxRetries ?? 2;

    if (!this.fetchImpl) {
      throw new Error(
        'HttpClient: no fetch implementation available — pass one via the `fetch` option (Node 18+ has fetch built in)'
      );
    }
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private buildHeaders(options: RequestOptions, hasJsonBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.credential}`,
      Accept: 'application/json',
      ...options.headers,
    };
    if (this.externalUserId) headers['x-persona-external-user-id'] = this.externalUserId;
    if (hasJsonBody) headers['Content-Type'] = 'application/json';
    return headers;
  }

  /**
   * Low-level escape hatch — every resource method is a thin wrapper over
   * this. Prefer the typed resource methods (`client.agents.create()` etc.)
   * unless you're calling an endpoint this SDK doesn't wrap yet.
   * @param method - HTTP method.
   * @param path - Path relative to `baseUrl`, e.g. `/api/v1/developer/agents`.
   * @param options - `query` params (undefined values are omitted), `body`
   *   (plain object is JSON-serialized, `FormData` sent as multipart),
   *   extra `headers`, and an optional `signal` for cancellation.
   * @returns The parsed `data` field from the API's `{success, data}`
   *   envelope. Throws {@link PersonaApiError} (or a subclass) on any
   *   non-2xx or `{success:false}` response.
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const bodyIsFormData = isFormData(options.body);
    const url = this.buildUrl(path, options.query);
    const headers = this.buildHeaders(options, options.body !== undefined && !bodyIsFormData);
    const body =
      options.body === undefined
        ? undefined
        : bodyIsFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body);

    let attempt = 0;
    for (;;) {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: options.signal,
      });

      if (response.status === 429 && attempt < this.maxRetries) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : 1;
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, retryAfterSeconds) * 1000));
        attempt += 1;
        continue;
      }

      return this.parseResponse<T>(response);
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      if (!response.ok) {
        throw new PersonaApiError(
          `Request failed with status ${response.status}`,
          response.status,
          'NON_JSON_ERROR_RESPONSE'
        );
      }
      // Binary/stream responses (e.g. file downloads) — caller handles the raw Response instead.
      return response as unknown as T;
    }

    const json = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope | undefined;

    if (!response.ok || json?.success === false) {
      throw errorFromResponse(response.status, json as ErrorEnvelope | undefined);
    }

    // `data` is the documented envelope field; fall back to the raw body for
    // any endpoint that (like /whoami) omits the fuller envelope shape.
    if (json && typeof json === 'object' && 'data' in json) {
      return (json as SuccessEnvelope<T>).data;
    }
    return json as T;
  }
}
