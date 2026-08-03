import type { HttpClient } from '../http.js';
import type { ListFilesParams, PersonaFile, UploadFilePayload } from '../types/file.js';
import type { BulkDeleteResult } from '../types/bulkDelete.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * Files (`/api/v1/developer/files`) — a file's Subject is a person, so
 * every call here requires this client to have been constructed with
 * `externalUserId` set (mirrors `ThreadsResource`'s requirement exactly).
 */
export class FilesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * `idempotencyKey`, if provided, is sent as the `Idempotency-Key` header —
   * a safe retry with the same key replays the original response instead
   * of uploading a duplicate file.
   */
  async upload(input: UploadFilePayload, idempotencyKey?: string): Promise<PersonaFile> {
    const form = new FormData();
    const blob =
      input.content instanceof Blob
        ? input.content
        : new Blob([input.content], { type: input.contentType });
    form.append('file', blob, input.filename);
    if (input.agentId) form.append('agentId', input.agentId);
    if (input.threadId) form.append('threadId', input.threadId);

    return this.http.request<PersonaFile>('POST', '/api/v1/developer/files', {
      body: form,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  async list(params: ListFilesParams = {}): Promise<PaginatedResult<PersonaFile>> {
    return this.http.request<PaginatedResult<PersonaFile>>('GET', '/api/v1/developer/files', {
      query: { ...params },
    });
  }

  /**
   * Returns the raw `Response` (a mediated file stream, never JSON) — call
   * `.arrayBuffer()`/`.blob()` or pipe `.body` onward as your framework needs.
   */
  async download(fileId: string): Promise<Response> {
    return this.http.request<Response>('GET', `/api/v1/developer/files/${fileId}`);
  }

  async delete(fileId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/files/${fileId}`);
  }

  /** Best-effort batch delete — up to 100 ids per call; partial failures don't throw. */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/files/bulk-delete', {
      body: { ids },
    });
  }
}
