import type { RuntimeMethod, RuntimeRequest, RuntimeUploadedFile } from '@personaai/runtime';

/** Adapter-side translation failure (a body that isn't valid JSON, an unreadable multipart body). */
export class TranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationError';
  }
}

/**
 * The second argument Next.js passes to an App Router route handler. `params`
 * is a plain object in Next 14 and a Promise in Next 15+ — both are accepted.
 */
export interface NextRouteContext {
  params?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Resolves the runtime-facing path.
 *
 * Preferred source is the catch-all segment (`app/api/persona/[...persona]/route.ts`
 * → `params.persona === ['chat']`), because it is already mount-relative no
 * matter where the developer put the route file or what they named the
 * segment. Next hands those segments URL-decoded, so they are re-encoded here
 * — the runtime decodes `:param` captures itself, and double-decoding would
 * corrupt a segment containing a literal `%`.
 *
 * Falls back to the full pathname (which the runtime strips `mountPath` from)
 * when the route isn't a catch-all.
 */
async function resolvePath(req: Request, ctx: NextRouteContext | undefined): Promise<string> {
  const params = await ctx?.params;
  if (params) {
    for (const value of Object.values(params)) {
      if (Array.isArray(value)) return `/${value.map(encodeURIComponent).join('/')}`;
    }
  }
  return new URL(req.url).pathname;
}

function toUploadedFile(value: File, content: Uint8Array): RuntimeUploadedFile {
  return {
    filename: value.name,
    content,
    contentType: value.type || undefined,
  };
}

/**
 * Parses a multipart body with the platform's own `Request.formData()` — zero
 * dependencies, and identical on Node and Edge. A `file` form field becomes
 * `RuntimeRequest.file`; any number of `files` fields become
 * `RuntimeRequest.files`; every other field lands on `body`.
 */
async function parseMultipart(req: Request): Promise<{
  file?: RuntimeUploadedFile;
  files?: RuntimeUploadedFile[];
  body: Record<string, unknown>;
}> {
  const formData = await req.formData();
  let file: RuntimeUploadedFile | undefined;
  const files: RuntimeUploadedFile[] = [];
  // Null-prototype: a field literally named `__proto__` must not become the
  // object's prototype. The runtime's body validation accepts it either way.
  const fields: Record<string, unknown> = Object.create(null) as Record<string, unknown>;

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'object' && value !== null && 'arrayBuffer' in value) {
      const uploaded = toUploadedFile(value as File, new Uint8Array(await value.arrayBuffer()));
      if (key === 'file') file = uploaded;
      else if (key === 'files') files.push(uploaded);
    } else {
      fields[key] = value;
    }
  }

  return { file, files: files.length > 0 ? files : undefined, body: fields };
}

/** Translates a Web `Request` (what a Next.js route handler receives) into the runtime's contract. */
export async function toRuntimeRequest(
  req: Request,
  ctx?: NextRouteContext
): Promise<RuntimeRequest> {
  const method = (req.method ?? 'GET').toUpperCase() as RuntimeMethod;
  const url = new URL(req.url);

  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) query[key] = value;

  const headers: Record<string, string | undefined> = {};
  // Web `Headers` already lowercases names and joins repeated values.
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const bodyless = method === 'GET' || method === 'DELETE';
  const contentType = (headers['content-type'] ?? '').toLowerCase();

  let body: unknown;
  let file: RuntimeUploadedFile | undefined;
  let files: RuntimeUploadedFile[] | undefined;

  if (!bodyless && contentType.includes('multipart/form-data')) {
    try {
      const parsed = await parseMultipart(req);
      file = parsed.file;
      files = parsed.files;
      body = parsed.body;
    } catch (err) {
      // A malformed/truncated multipart body is a client error, not a 500.
      throw new TranslationError(
        `Multipart request body could not be parsed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else if (!bodyless) {
    const text = await req.text();
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new TranslationError('Request body is not valid JSON.');
      }
    }
  }

  return {
    method,
    path: await resolvePath(req, ctx),
    headers,
    query,
    body,
    file,
    files,
    userId: null,
  };
}
