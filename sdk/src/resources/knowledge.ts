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

/**
 * Knowledge bases (`/api/v1/developer/knowledge`) — Project-owned, or, when
 * this client asserts an external user, owned by that end user.
 */
export class KnowledgeResource {
  constructor(private readonly http: HttpClient) {}

  async create(input: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {
    return this.http.request<KnowledgeBase>('POST', '/api/v1/developer/knowledge', {
      body: input,
    });
  }

  /** Note: returns a bare array — this endpoint has no pagination envelope. */
  async list(params: DiscoverKnowledgeBasesParams = {}): Promise<KnowledgeBase[]> {
    return this.http.request<KnowledgeBase[]>('GET', '/api/v1/developer/knowledge', {
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
