import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import { json, noContent, requireParam, requireBodyObject, toInt } from '../routeHelpers.js';

export const listFiles: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.files.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
  });
  return json(200, items);
};

export const uploadFile: RouteHandler = async (request, ctx) => {
  if (!request.file) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      'A "file" part is required on this request.'
    );
  }
  const fields = (request.body as Record<string, unknown> | undefined) ?? {};
  const agentId = typeof fields.agentId === 'string' ? fields.agentId : undefined;
  const threadId = typeof fields.threadId === 'string' ? fields.threadId : undefined;

  const file = await ctx.client.files.upload({
    filename: request.file.filename,
    content: request.file.content,
    contentType: request.file.contentType,
    agentId,
    threadId,
  });

  await ctx.hooks?.onFileUpload?.({
    userId: request.userId as string,
    fileName: request.file.filename,
    mimeType: request.file.contentType,
  });

  return json(201, file);
};

export const downloadFile: RouteHandler = async (_request, ctx) => {
  const response = await ctx.client.files.download(requireParam(ctx.params, 'id'));

  const headers: Record<string, string> = {};
  const contentType = response.headers.get('content-type');
  const contentDisposition = response.headers.get('content-disposition');
  if (contentType) headers['content-type'] = contentType;
  if (contentDisposition) headers['content-disposition'] = contentDisposition;

  if (!response.body) {
    return { kind: 'binary', status: response.status, headers, body: (async function* () {})() };
  }

  return {
    kind: 'binary',
    status: response.status,
    headers,
    body: response.body as unknown as AsyncIterable<Uint8Array>,
  };
};

export const deleteFile: RouteHandler = async (_request, ctx) => {
  await ctx.client.files.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const bulkDeleteFiles: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  const result = await ctx.client.files.bulkDelete(ids);
  return json(200, result);
};
