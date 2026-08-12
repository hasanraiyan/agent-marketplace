import type { Request } from 'express';
import type { RuntimeMethod, RuntimeRequest, RuntimeUploadedFile } from '@personaai/runtime';
import { collectMulterFiles, parseMultipart } from './multipart.js';

/** Adapter-side translation failure (bad JSON, already-consumed multipart body). */
export class TranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationError';
  }
}

async function readJsonBody(req: Request): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new TranslationError('Request body is not valid JSON.');
  }
}

/**
 * Translates an Express request into the runtime's framework-neutral contract.
 *
 * The body story is parser-aware: if the host already mounted `express.json()`
 * (which skips multipart), the parsed `req.body` is used; otherwise the raw
 * stream is read here. Multipart bodies are parsed natively unless the host's
 * own parser (e.g. multer) already consumed them.
 */
export async function toRuntimeRequest(req: Request): Promise<RuntimeRequest> {
  // Any method the runtime doesn't recognize simply won't match a route
  // pattern — its own routing 404s/405s it, no need to filter here.
  const method = (req.method ?? 'GET').toUpperCase() as RuntimeMethod;

  const url = new URL(req.originalUrl, 'http://localhost');
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) query[key] = value;

  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  const bodyless = method === 'GET' || method === 'DELETE';
  // Media types are case-insensitive per RFC 9110 — but the ORIGINAL header
  // (with its boundary, which IS case-sensitive) is what parseMultipart needs.
  const contentTypeHeader = headers['content-type'] ?? '';
  const contentType = contentTypeHeader.toLowerCase();

  let body: unknown;
  let file: RuntimeUploadedFile | undefined;
  let files: RuntimeUploadedFile[] | undefined;

  if (!bodyless && contentType.includes('multipart/form-data')) {
    const parsedByHost = collectMulterFiles(req);
    if (parsedByHost) {
      file = parsedByHost.file;
      files = parsedByHost.files;
      body = req.body;
    } else if (req.readableEnded) {
      throw new TranslationError(
        'Multipart request body was consumed by a body parser before the Persona adapter could read it. Mount the adapter before any multipart body parser, or remove the parser.'
      );
    } else {
      try {
        const parsed = await parseMultipart(req, contentTypeHeader);
        file = parsed.file;
        files = parsed.files;
        body = parsed.body;
      } catch (err) {
        if (err instanceof TranslationError) throw err;
        // A malformed/truncated multipart body is a client error, not a 500.
        throw new TranslationError(
          `Multipart request body could not be parsed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } else if (!bodyless) {
    body = req.body ?? (await readJsonBody(req));
  }

  return {
    method,
    // req.path is mount-relative inside a mounted router; the runtime's
    // stripMountPath is tolerant either way.
    path: req.path,
    headers,
    query,
    body,
    file,
    files,
    userId: null,
  };
}
