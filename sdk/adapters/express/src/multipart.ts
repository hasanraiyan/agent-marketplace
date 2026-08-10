import { Readable } from 'node:stream';
import type { Request } from 'express';
import type { RuntimeUploadedFile } from '@personaai/runtime';

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
  req: Request
): { file?: RuntimeUploadedFile; files?: RuntimeUploadedFile[] } | null {
  const multerReq = req as MulterRequest;
  const file = multerReq.file;
  const files = multerReq.files;
  if (!file && !files) return null;

  const mappedFile = file ? toUploadedFile(file) : undefined;
  const array = Array.isArray(files) ? files : files ? Object.values(files).flat() : [];
  return {
    file: mappedFile,
    files: array.length > 0 ? array.map(toUploadedFile) : undefined,
  };
}

/**
 * Parses a raw multipart body with Node's native `Request`/`FormData` (undici)
 * — the same zero-dependency approach as `@personaai/runtime`'s
 * `examples/node-handler.ts`. A `file` form field becomes
 * `RuntimeRequest.file`; any number of `files` form fields become
 * `RuntimeRequest.files`; every other field lands on `body`.
 */
export async function parseMultipart(req: Request, contentType: string): Promise<MultipartResult> {
  const request = new Request('http://internal/', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
    duplex: 'half',
  } as RequestInit);

  const formData = await request.formData();
  let file: RuntimeUploadedFile | undefined;
  const files: RuntimeUploadedFile[] = [];
  // Null-prototype: a field literally named `__proto__` (with a File value)
  // must not become the object's prototype. The runtime's requireBodyObject
  // accepts it and JSON.stringify works the same.
  const fields: Record<string, unknown> = Object.create(null) as Record<string, unknown>;

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const uploaded: RuntimeUploadedFile = {
        filename: value.name,
        content: new Uint8Array(await value.arrayBuffer()),
        contentType: value.type || undefined,
      };
      if (key === 'file') file = uploaded;
      else if (key === 'files') files.push(uploaded);
    } else {
      fields[key] = value;
    }
  }

  return { file, files: files.length > 0 ? files : undefined, body: fields };
}
