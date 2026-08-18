import type { RuntimeMethod, RuntimeRequest, RuntimeUploadedFile } from '@personaai/runtime';
import { collectMulterFiles, parseMultipart } from './multipart.js';

export class TranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationError';
  }
}

async function readJsonBody(req: any): Promise<unknown> {
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

export async function toRuntimeRequest(req: any): Promise<RuntimeRequest> {
  const method = (req.method ?? 'GET').toUpperCase() as RuntimeMethod;

  const url = new URL(req.originalUrl || req.url, 'http://localhost');
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) query[key] = value;

  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    headers[key] = Array.isArray(value) ? value.join(', ') : (value as string | undefined);
  }

  const bodyless = method === 'GET' || method === 'DELETE';
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
    path: req.path || url.pathname,
    headers,
    query,
    body,
    file,
    files,
    userId: null,
  };
}
