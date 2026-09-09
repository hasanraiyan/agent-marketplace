import type { RuntimeMethod, RuntimeRequest, RuntimeUploadedFile } from '@personaai/runtime';
import type { Logger } from '@personaai/logger';
import { TranslationError } from './errors.js';
import { redactHeaders } from './headers.js';
import { readJsonBody } from './json.js';
import { collectMulterFiles, parseMultipart } from './multipart-node.js';

export interface NodeTranslateOptions {
  /** Extract mount-relative path; defaults to req.path || url.pathname */
  getPath?: (req: any, url: URL) => string;
}

/**
 * Shared Node/Express/Nest translator: Node `req` → `RuntimeRequest`.
 * Used by both express and nestjs (they differ only in `getPath` and typing).
 */
export async function toRuntimeRequestNode(
  req: any,
  logger?: Logger,
  opts?: NodeTranslateOptions,
): Promise<RuntimeRequest> {
  const log = logger?.child('translate');
  const method = (req.method ?? 'GET').toUpperCase() as RuntimeMethod;

  const url = new URL(req.originalUrl || req.url, 'http://localhost');
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) query[key] = value;

  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    headers[key] = Array.isArray(value) ? value.join(', ') : (value as string | undefined);
  }

  const path = opts?.getPath ? opts.getPath(req, url) : req.path || url.pathname;

  log?.debug('translate start', { method, path, originalUrl: req.originalUrl || req.url });
  log?.trace('translate headers', { headers: redactHeaders(headers) });
  log?.trace('translate query', { query, hasQuery: Object.keys(query).length > 0 });

  const bodyless = method === 'GET' || method === 'DELETE';
  const contentTypeHeader = headers['content-type'] ?? '';
  const contentType = contentTypeHeader.toLowerCase();

  log?.debug('translate content-type', {
    contentTypeHeader: contentTypeHeader ? '[present]' : '[none]',
    isMultipart: contentType.includes('multipart/form-data'),
    bodyless,
  });

  let body: unknown;
  let file: RuntimeUploadedFile | undefined;
  let files: RuntimeUploadedFile[] | undefined;

  if (!bodyless && contentType.includes('multipart/form-data')) {
    log?.info('multipart request detected', { path, method });
    const parsedByHost = collectMulterFiles(req, logger);
    if (parsedByHost) {
      file = parsedByHost.file;
      files = parsedByHost.files;
      body = req.body;
      log?.info('multipart via host parser (multer)', {
        hasFile: !!file,
        fileCount: files?.length ?? 0,
        hasBody: body !== undefined,
      });
    } else if (req.readableEnded) {
      log?.warn('multipart body already consumed', { path, readableEnded: req.readableEnded });
      throw new TranslationError(
        'Multipart request body was consumed by a body parser before the Persona adapter could read it. Mount the adapter before any multipart body parser, or remove the parser.',
      );
    } else {
      log?.debug('parsing multipart natively', { path });
      try {
        const parsed = await parseMultipart(req, contentTypeHeader, logger);
        file = parsed.file;
        files = parsed.files;
        body = parsed.body;
        log?.info('multipart parsed natively', {
          hasFile: !!file,
          fileCount: files?.length ?? 0,
          fieldCount: Object.keys(parsed.body).length,
        });
      } catch (err) {
        if (err instanceof TranslationError) throw err;
        log?.error('multipart parse failed', {
          error: err instanceof Error ? err.message : String(err),
          path,
        });
        throw new TranslationError(
          `Multipart request body could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } else if (!bodyless) {
    const hasHostBody = req.body !== undefined;
    log?.debug('json body handling', { hasHostBody, path });
    try {
      body = req.body ?? (await readJsonBody(req, logger));
      log?.debug('json body resolved', { hasBody: body !== undefined, path });
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      log?.error('json body unexpected error', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  } else {
    log?.debug('bodyless request — skipping body parse', { method, path });
  }

  const result: RuntimeRequest = {
    method,
    path,
    headers,
    query,
    body,
    file,
    files,
    userId: null,
  };

  log?.info('translate complete', {
    method,
    path,
    hasBody: body !== undefined,
    hasFile: !!file,
    fileCount: files?.length ?? 0,
  });

  return result;
}
