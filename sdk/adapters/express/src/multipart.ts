import { Readable } from 'node:stream';
import type { Request } from 'express';
import type { RuntimeUploadedFile } from '@personaai/runtime';
import type { Logger } from '@personaai/sdk';

/** Minimal structural shape of a multer-parsed file — this adapter never depends on multer's types. */
interface MulterFileLike {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

/** Express's base Request type has no `file`/`files` (they're multer's augmentation) — this adapter's own view of it. */
interface MulterRequest extends Request {
  file?: MulterFileLike;
  files?: MulterFileLike[] | Record<string, MulterFileLike[]>;
}

export interface MultipartResult {
  file?: RuntimeUploadedFile;
  files?: RuntimeUploadedFile[];
  body: Record<string, unknown>;
}

function toUploadedFile(file: MulterFileLike): RuntimeUploadedFile {
  return {
    filename: file.originalname,
    content: new Uint8Array(file.buffer),
    contentType: file.mimetype || undefined,
  };
}

/**
 * If the host already used a multipart parser (e.g. multer) and the request
 * carries parsed files, map them to the runtime's shape and skip re-reading
 * the (already consumed) raw stream. Returns `null` when nothing was parsed.
 */
export function collectMulterFiles(
  req: Request,
  logger?: Logger
): { file?: RuntimeUploadedFile; files?: RuntimeUploadedFile[] } | null {
  const log = logger?.child('multipart');
  const multerReq = req as MulterRequest;
  const file = multerReq.file;
  const files = multerReq.files;
  const hasFile = !!file;
  const rawFiles = files;
  log?.trace('collectMulterFiles check', { hasFile, hasFiles: !!rawFiles });
  if (!file && !files) {
    log?.trace('collectMulterFiles — no host-parsed files');
    return null;
  }

  const mappedFile = file ? toUploadedFile(file) : undefined;
  const array = Array.isArray(files) ? files : files ? Object.values(files).flat() : [];
  const result = {
    file: mappedFile,
    files: array.length > 0 ? array.map(toUploadedFile) : undefined,
  };
  log?.debug('collectMulterFiles mapped', {
    hasFile: !!mappedFile,
    fileName: mappedFile?.filename,
    fileCount: result.files?.length ?? 0,
  });
  log?.info('collected multer files', {
    hasFile: !!mappedFile,
    fileCount: result.files?.length ?? 0,
  });
  if (result.files) {
    for (const f of result.files) {
      log?.trace('multer file', { filename: f.filename, size: f.content.length });
    }
  }
  if (mappedFile) {
    log?.trace('multer file', { filename: mappedFile.filename, size: mappedFile.content.length });
  }
  return result;
}

/**
 * Parses a raw multipart body with Node's native `Request`/`FormData` (undici)
 * — the same zero-dependency approach as `@personaai/runtime`'s
 * `examples/node-handler.ts`. A `file` form field becomes
 * `RuntimeRequest.file`; any number of `files` form fields become
 * `RuntimeRequest.files`; every other field lands on `body`.
 */
export async function parseMultipart(
  req: Request,
  contentType: string,
  logger?: Logger
): Promise<MultipartResult> {
  const log = logger?.child('multipart');
  log?.debug('parseMultipart start', {
    contentType: contentType ? '[present]' : '[missing]',
  });
  log?.trace('parseMultipart content-type header', { headerLength: contentType.length });
  // Never log the raw boundary/credential — boundary is part of header.
  log?.info('multipart native parse start', {});

  const request = new Request('http://internal/', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
    duplex: 'half',
  } as RequestInit);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    log?.error('parseMultipart formData failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  let file: RuntimeUploadedFile | undefined;
  const files: RuntimeUploadedFile[] = [];
  // Null-prototype: a field literally named `__proto__` (with a File value)
  // must not become the object's prototype. The runtime's requireBodyObject
  // accepts it and JSON.stringify works the same.
  const fields: Record<string, unknown> = Object.create(null) as Record<string, unknown>;

  let fieldCount = 0;
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const uploaded: RuntimeUploadedFile = {
        filename: value.name,
        content: new Uint8Array(await value.arrayBuffer()),
        contentType: value.type || undefined,
      };
      if (key === 'file') {
        file = uploaded;
        log?.debug('parseMultipart found file field', {
          filename: uploaded.filename,
          size: uploaded.content.length,
        });
        log?.trace('multipart file details', {
          field: key,
          filename: uploaded.filename,
          contentType: uploaded.contentType,
          size: uploaded.content.length,
        });
      } else if (key === 'files') {
        files.push(uploaded);
        log?.debug('parseMultipart found files field', {
          filename: uploaded.filename,
          size: uploaded.content.length,
          totalFiles: files.length,
        });
        log?.trace('multipart files details', {
          field: key,
          filename: uploaded.filename,
          contentType: uploaded.contentType,
          size: uploaded.content.length,
        });
      } else {
        // Unknown file field — still trace but warn that it's unexpected.
        log?.warn('parseMultipart unexpected file field', {
          field: key,
          filename: uploaded.filename,
        });
        log?.trace('multipart unexpected file', {
          field: key,
          filename: uploaded.filename,
          size: uploaded.content.length,
        });
      }
    } else {
      fields[key] = value;
      fieldCount++;
      log?.trace('multipart field', { field: key, valueLength: String(value).length });
    }
  }

  log?.debug('parseMultipart completed', {
    hasFile: !!file,
    fileCount: files.length,
    fieldCount,
  });
  log?.info('multipart parsed', {
    hasFile: !!file,
    fileCount: files.length,
    fieldCount,
  });
  if (files.length === 0 && !file) {
    log?.warn('parseMultipart no files found', { fieldCount });
  }

  return { file, files: files.length > 0 ? files : undefined, body: fields };
}
