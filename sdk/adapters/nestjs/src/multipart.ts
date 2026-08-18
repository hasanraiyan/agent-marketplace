import { Readable } from 'node:stream';
import type { RuntimeUploadedFile } from '@personaai/runtime';

interface MulterFileLike {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

interface MulterRequest {
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

export function collectMulterFiles(
  req: any
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

export async function parseMultipart(req: any, contentType: string): Promise<MultipartResult> {
  const request = new Request('http://internal/', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
    duplex: 'half',
  } as RequestInit);

  const formData = await request.formData();
  let file: RuntimeUploadedFile | undefined;
  const files: RuntimeUploadedFile[] = [];
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
