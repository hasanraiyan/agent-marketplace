import type { HttpClient } from '../http.js';
import type {
  CreateKnowledgeBaseInput,
  DeleteDocumentResult,
  DiscoverKnowledgeBasesParams,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeSearchResult,
  UpdateKnowledgeBaseInput,
  UploadDocumentsResult,
  UploadFileInput,
} from '../types/knowledge.js';
import type { ResourceUsage } from '../types/usage.js';
import type { BulkDeleteResult } from '../types/bulkDelete.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * Knowledge bases (`/api/v1/developer/knowledge`) — Project-owned, or, when
 * this client asserts an external user, owned by that end user.
 */
export class KnowledgeResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new (empty) Knowledge base. Upload documents afterward via
   * {@link KnowledgeResource.uploadDocuments}.
   * @param input - `name` and `providerId` are required (the Provider
   *   supplies the embedding model's API key).
   * @param idempotencyKey - Optional. Sent as the `Idempotency-Key` header —
   *   a safe retry with the same key replays the original response instead
   *   of creating a duplicate Knowledge Base.
   * @returns The created {@link KnowledgeBase} (raw Mongo shape — `_id`, not `id`).
   */
  async create(
    input: CreateKnowledgeBaseInput,
    idempotencyKey?: string
  ): Promise<KnowledgeBase> {
    return this.http.request<KnowledgeBase>('POST', '/api/v1/developer/knowledge', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /**
   * Lists/searches Knowledge bases visible to this credential (this
   * Project's own, plus any public ones).
   * @param params - `page` (default `1`), `limit` (default `20`), `search`
   *   (free-text), `scope: 'mine'` (restricts to the asserted external
   *   user's own Knowledge Bases — `ProjectRuntimeContext` only).
   * @returns `{ items, pagination: { total, page, limit, pages } }`.
   */
  async list(params: DiscoverKnowledgeBasesParams = {}): Promise<PaginatedResult<KnowledgeBase>> {
    return this.http.request<PaginatedResult<KnowledgeBase>>('GET', '/api/v1/developer/knowledge', {
      query: { ...params },
    });
  }

  /**
   * Fetches a single Knowledge base by id.
   * @param kbId - The Knowledge base's `_id`.
   */
  async get(kbId: string): Promise<KnowledgeBase> {
    return this.http.request<KnowledgeBase>('GET', `/api/v1/developer/knowledge/${kbId}`);
  }

  /**
   * Partially updates a Knowledge base — only the fields you pass are
   * changed. Note: changing `providerId`/`embeddingModel`/`chunkSize`/
   * `chunkOverlap` does not retroactively re-embed already-uploaded
   * documents.
   * @param kbId - The Knowledge base's `_id`.
   */
  async update(kbId: string, input: UpdateKnowledgeBaseInput): Promise<KnowledgeBase> {
    return this.http.request<KnowledgeBase>('PATCH', `/api/v1/developer/knowledge/${kbId}`, {
      body: input,
    });
  }

  /**
   * Deletes a Knowledge base and all its embedded chunks.
   * @param kbId - The Knowledge base's `_id`.
   */
  async delete(kbId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/knowledge/${kbId}`);
  }

  /**
   * Agents referencing this Knowledge base. Note: unlike Providers/Skills/MCP,
   * Knowledge base deletion does not currently block on in-use Agents — this
   * is informational only.
   * @param kbId - The Knowledge base's `_id`.
   * @returns `agentCount` is the real total; `agents` is a preview capped at 20.
   */
  async getUsage(kbId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>('GET', `/api/v1/developer/knowledge/${kbId}/usage`);
  }

  /**
   * Best-effort batch delete — partial failures don't throw or abort the
   * rest of the batch.
   * @param ids - Up to 100 Knowledge base ids per call.
   * @returns `{ deleted, failed }` — check `failed` for per-id reasons.
   */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/knowledge/bulk-delete', {
      body: { ids },
    });
  }

  /**
   * Uploads and chunks/embeds one or more documents into this Knowledge base.
   * This call is synchronous — it returns only once embedding finishes, so
   * expect it to take longer for larger/more files.
   * @param kbId - The Knowledge base's `_id`.
   * @param files - Up to 10 files per call, 20MB each. Supported types: PDF, TXT, MD, JSON, CSV.
   * @example
   * ```ts
   * const result = await client.knowledge.uploadDocuments(kbId, [
   *   { filename: 'handbook.pdf', content: fileBuffer, contentType: 'application/pdf' },
   * ]);
   * ```
   */
  async uploadDocuments(kbId: string, files: UploadFileInput[]): Promise<UploadDocumentsResult> {
    const form = new FormData();
    for (const file of files) {
      const blob =
        file.content instanceof Blob
          ? file.content
          : new Blob([file.content], { type: file.contentType });
      form.append('files', blob, file.filename);
    }
    return this.http.request<UploadDocumentsResult>(
      'POST',
      `/api/v1/developer/knowledge/${kbId}/documents`,
      { body: form }
    );
  }

  /**
   * Lists the distinct source documents currently chunked/embedded in this
   * Knowledge base (not the individual chunks themselves).
   * @param kbId - The Knowledge base's `_id`.
   */
  async listDocuments(kbId: string): Promise<KnowledgeDocument[]> {
    return this.http.request<KnowledgeDocument[]>(
      'GET',
      `/api/v1/developer/knowledge/${kbId}/documents`
    );
  }

  /**
   * Deletes every chunk that came from one uploaded source document.
   * @param kbId - The Knowledge base's `_id`.
   * @param sourceName - The document's `fileName` as returned by {@link KnowledgeResource.listDocuments}.
   */
  async deleteDocument(kbId: string, sourceName: string): Promise<DeleteDocumentResult> {
    return this.http.request<DeleteDocumentResult>(
      'DELETE',
      `/api/v1/developer/knowledge/${kbId}/documents/${encodeURIComponent(sourceName)}`
    );
  }

  /**
   * Runs a similarity search against this Knowledge base's embedded chunks
   * — the same retrieval an Agent with this Knowledge base attached would
   * use internally.
   * @param kbId - The Knowledge base's `_id`.
   * @param query - The natural-language search text.
   * @param options.topK - Max number of chunks to return. Defaults to the
   *   Knowledge base's own configured `topK` (set at creation, default `5`).
   */
  async search(
    kbId: string,
    query: string,
    options: { topK?: number } = {}
  ): Promise<KnowledgeSearchResult[]> {
    return this.http.request<KnowledgeSearchResult[]>(
      'POST',
      `/api/v1/developer/knowledge/${kbId}/search`,
      { body: { query, topK: options.topK } }
    );
  }
}
