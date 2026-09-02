import type { RuntimeMethod, RuntimeRequest, RuntimeUploadedFile } from '@personaai/runtime';
import type { Logger } from '@personaai/sdk';
import { collectMulterFiles, parseMultipart } from './multipart.js';

export class TranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationError';
  }
}

function redactHeaders(
  headers: Record<string, string | undefined>
): Record<string, string | undefined> {
  const redacted: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    if (k.toLowerCase() === 'authorization') redacted[k] = '***';
    else redacted[k] = v;
  }
  return redacted;
}

async function readJsonBody(req: any, logger?: Logger): Promise<unknown> {
  const log = logger?.child('translate');
  log?.trace('readJsonBody start', { readableEnded: req.readableEnded });
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) {
    log?.trace('readJsonBody empty stream');
    return undefined;
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) {
    log?.trace('readJsonBody empty text');
    return undefined;
  }
  log?.debug('readJsonBody raw text length', { length: text.length });
  try {
    const parsed = JSON.parse(text);
    log?.trace('readJsonBody parsed', {
      keys: parsed && typeof parsed === 'object' ? Object.keys(parsed as object) : undefined,
    });
    return parsed;
  } catch (err) {
    log?.error('readJsonBody invalid JSON', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new TranslationError('Request body is not valid JSON.');
  }
}

export async function toRuntimeRequest(req: any, logger?: Logger): Promise<RuntimeRequest> {
  const log = logger?.child('translate');
  const method = (req.method ?? 'GET').toUpperCase() as RuntimeMethod;

  const url = new URL(req.originalUrl || req.url, 'http://localhost');
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) query[key] = value;

  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    headers[key] = Array.isArray(value) ? value.join(', ') : (value as string | undefined);
  }

  log?.debug('translate start', {
    method,
    path: req.path || url.pathname,
    originalUrl: req.originalUrl || req.url,
  });
  log?.trace('translate headers', { headers: redactHeaders(headers) });
  log?.trace('translate query', {
    query,
    hasQuery: Object.keys(query).length > 0,
  });
  log?.trace('translate path details', {
    path: req.path || url.pathname,
    originalUrl: req.originalUrl || req.url,
    hasOriginalUrl: !!(req.originalUrl || req.url),
  });

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
    log?.info('multipart request detected', {
      path: req.path || url.pathname,
      method,
    });
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
      log?.debug('multipart host-parsed details', {
        fileName: file?.filename,
        fileCount: files?.length ?? 0,
      });
    } else if (req.readableEnded) {
      log?.warn('multipart body already consumed', {
        path: req.path || url.pathname,
        readableEnded: req.readableEnded,
      });
      log?.error('multipart translation failed — stream consumed', {
        path: req.path || url.pathname,
      });
      throw new TranslationError(
        'Multipart request body was consumed by a body parser before the Persona adapter could read it. Mount the adapter before any multipart body parser, or remove the parser.'
      );
    } else {
      log?.debug('parsing multipart natively', {
        path: req.path || url.pathname,
      });
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
        log?.debug('multipart native details', {
          fileName: file?.filename,
          fileCount: files?.length ?? 0,
        });
        log?.trace('multipart fields', { fields: Object.keys(parsed.body) });
      } catch (err) {
        if (err instanceof TranslationError) {
          log?.error('multipart TranslationError', {
            error: err.message,
            path: req.path || url.pathname,
          });
          throw err;
        }
        log?.error('multipart parse failed', {
          error: err instanceof Error ? err.message : String(err),
          path: req.path || url.pathname,
        });
        throw new TranslationError(
          `Multipart request body could not be parsed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } else if (!bodyless) {
    const hasHostBody = req.body !== undefined;
    log?.debug('json body handling', {
      hasHostBody,
      path: req.path || url.pathname,
    });
    if (hasHostBody) {
      log?.trace('using host-parsed body', {
        bodyKeys:
          req.body && typeof req.body === 'object' ? Object.keys(req.body as object) : undefined,
        hasBody: true,
      });
    } else {
      log?.trace('reading raw json stream', { path: req.path || url.pathname });
    }
    try {
      body = req.body ?? (await readJsonBody(req, logger));
      log?.debug('json body resolved', {
        hasBody: body !== undefined,
        path: req.path || url.pathname,
      });
      if (body !== undefined) {
        log?.trace('json body keys', {
          keys: body && typeof body === 'object' ? Object.keys(body as object) : typeof body,
        });
      }
    } catch (err) {
      if (err instanceof TranslationError) {
        log?.warn('json body translation failed', {
          error: err.message,
          path: req.path || url.pathname,
        });
        throw err;
      }
      log?.error('json body unexpected error', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  } else {
    log?.debug('bodyless request — skipping body parse', {
      method,
      path: req.path || url.pathname,
    });
  }

  const result: RuntimeRequest = {
    method,
    path: req.path || url.pathname,
    headers,
    query,
    body,
    file,
    files,
    userId: null,
  };

  log?.info('translate complete', {
    method,
    path: req.path || url.pathname,
    hasBody: body !== undefined,
    hasFile: !!file,
    fileCount: files?.length ?? 0,
  });
  log?.trace('translate result', {
    method,
    path: req.path || url.pathname,
    queryKeys: Object.keys(query),
    hasFile: !!file,
    fileCount: files?.length ?? 0,
  });

  return result;
}
