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
   * `idempotencyKey`, if provided, is sent as the `Idempotency-Key` header —
   * a safe retry with the same key replays the original response instead
   * of creating a duplicate Knowledge Base.
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

  async list(params: DiscoverKnowledgeBasesParams = {}): Promise<PaginatedResult<KnowledgeBase>> {
    return this.http.request<PaginatedResult<KnowledgeBase>>('GET', '/api/v1/developer/knowledge', {
      query: { ...params },
    });
  }

  async get(kbId: string): Promise<KnowledgeBase> {
    return this.http.request<KnowledgeBase>('GET', `/api/v1/developer/knowledge/${kbId}`);
  }

  async update(kbId: string, input: UpdateKnowledgeBaseInput): Promise<KnowledgeBase> {
    return this.http.request<KnowledgeBase>('PATCH', `/api/v1/developer/knowledge/${kbId}`, {
      body: input,
    });
  }

  async delete(kbId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/knowledge/${kbId}`);
  }

  /**
   * Agents referencing this Knowledge base. Note: unlike Providers/Skills/MCP,
   * Knowledge base deletion does not currently block on in-use Agents — this
   * is informational only.
   */
  async getUsage(kbId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>('GET', `/api/v1/developer/knowledge/${kbId}/usage`);
  }

  /** Best-effort batch delete — up to 100 ids per call; partial failures don't throw. */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/knowledge/bulk-delete', {
      body: { ids },
    });
  }

  /** Up to 10 files, 20MB each; PDF/TXT/MD/JSON/CSV. */
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

  async listDocuments(kbId: string): Promise<KnowledgeDocument[]> {
    return this.http.request<KnowledgeDocument[]>(
      'GET',
      `/api/v1/developer/knowledge/${kbId}/documents`
    );
  }

  async deleteDocument(kbId: string, sourceName: string): Promise<DeleteDocumentResult> {
    return this.http.request<DeleteDocumentResult>(
      'DELETE',
      `/api/v1/developer/knowledge/${kbId}/documents/${encodeURIComponent(sourceName)}`
    );
  }

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
