import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { Runtime, RuntimeMethod, RuntimeRequest, RuntimeUploadedFile } from '../src/index.js';

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) return undefined;
  return JSON.parse(text);
}

/**
 * `POST /files` needs raw bytes, not JSON — parsed here via Node's native
 * `Request`/`FormData` (undici), no extra multipart-parsing dependency.
 * Only the `content-type` header (which carries the multipart boundary)
 * is forwarded; nothing else about the original request matters for
 * parsing the body itself.
 */
async function readMultipartBody(
  req: IncomingMessage,
  contentType: string
): Promise<{ file?: RuntimeUploadedFile; body: Record<string, unknown> }> {
  const request = new Request('http://internal/', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
    duplex: 'half',
  } as RequestInit);

  const formData = await request.formData();
  let file: RuntimeUploadedFile | undefined;
  const fields: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (key === 'file') {
        file = {
          filename: value.name,
          content: new Uint8Array(await value.arrayBuffer()),
          contentType: value.type || undefined,
        };
      }
    } else {
      fields[key] = value;
    }
  }

  return { file, body: fields };
}

export async function toRuntimeRequest(req: IncomingMessage): Promise<RuntimeRequest> {
  // Any method the runtime doesn't recognize simply won't match a route
  // pattern — its own routing 404s/405s it, no need to filter here.
  const method = (req.method ?? 'GET').toUpperCase() as RuntimeMethod;

  const url = new URL(req.url ?? '/', 'http://localhost');
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) query[key] = value;

  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  const bodyless = method === 'GET' || method === 'DELETE';
  const contentType = headers['content-type'] ?? '';

  let body: unknown;
  let file: RuntimeUploadedFile | undefined;
  if (!bodyless && contentType.includes('multipart/form-data')) {
    const parsed = await readMultipartBody(req, contentType);
    body = parsed.body;
    file = parsed.file;
  } else if (!bodyless) {
    body = await readJsonBody(req);
  }

  return {
    method,
    path: url.pathname,
    headers,
    query,
    body,
    file,
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
