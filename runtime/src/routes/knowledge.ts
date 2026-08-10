import type { CreateKnowledgeBaseInput, UpdateKnowledgeBaseInput } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import {
  json,
  noContent,
  requireParam,
  requireBodyObject,
  requireStringField,
  toInt,
} from '../routeHelpers.js';

// Everything here requires capabilities.knowledge — knowledge base
// provisioning and document management is Project-level content
// management, not an end-user chat operation. (`search` is arguably closer
// to an end-user-facing read, but it's gated the same as the rest of this
// resource for consistency — a host that wants search only can still wire
// that up itself via the raw SDK.)

export const listKnowledgeBases: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.knowledge.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    search: request.query.search,
    scope: request.query.scope === 'mine' ? 'mine' : undefined,
  });
  return json(200, items);
};

export const createKnowledgeBase: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input: CreateKnowledgeBaseInput = {
    name: requireStringField(body, 'name'),
    providerId: requireStringField(body, 'providerId'),
    description: typeof body.description === 'string' ? body.description : undefined,
    isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : undefined,
    embeddingModel: typeof body.embeddingModel === 'string' ? body.embeddingModel : undefined,
    chunkSize: typeof body.chunkSize === 'number' ? body.chunkSize : undefined,
    chunkOverlap: typeof body.chunkOverlap === 'number' ? body.chunkOverlap : undefined,
    topK: typeof body.topK === 'number' ? body.topK : undefined,
  };
  const kb = await ctx.client.knowledge.create(input);
  return json(201, kb);
};

export const getKnowledgeBase: RouteHandler = async (_request, ctx) => {
  const kb = await ctx.client.knowledge.get(requireParam(ctx.params, 'id'));
  return json(200, kb);
};

export const updateKnowledgeBase: RouteHandler = async (request, ctx) => {
  const body = (request.body as UpdateKnowledgeBaseInput | undefined) ?? {};
  const kb = await ctx.client.knowledge.update(requireParam(ctx.params, 'id'), body);
  return json(200, kb);
};

export const deleteKnowledgeBase: RouteHandler = async (_request, ctx) => {
  await ctx.client.knowledge.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const bulkDeleteKnowledgeBases: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  const result = await ctx.client.knowledge.bulkDelete(ids);
  return json(200, result);
};

export const getKnowledgeBaseUsage: RouteHandler = async (_request, ctx) => {
  const usage = await ctx.client.knowledge.getUsage(requireParam(ctx.params, 'id'));
  return json(200, usage);
};

export const uploadKnowledgeDocuments: RouteHandler = async (request, ctx) => {
  if (!request.files || request.files.length === 0) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      'At least one "files" part is required on this request.'
    );
  }
  const result = await ctx.client.knowledge.uploadDocuments(
    requireParam(ctx.params, 'id'),
    request.files.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType,
    }))
  );
  return json(201, result);
};

export const listKnowledgeDocuments: RouteHandler = async (_request, ctx) => {
  const documents = await ctx.client.knowledge.listDocuments(requireParam(ctx.params, 'id'));
  return json(200, documents);
};

export const deleteKnowledgeDocument: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.knowledge.deleteDocument(
    requireParam(ctx.params, 'id'),
    requireParam(ctx.params, 'sourceName')
  );
  return json(200, result);
};

export const searchKnowledgeBase: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const query = requireStringField(body, 'query');
  const topK = typeof body.topK === 'number' ? body.topK : undefined;
  const results = await ctx.client.knowledge.search(requireParam(ctx.params, 'id'), query, {
    topK,
  });
  return json(200, results);
};
