import type { HttpClient } from '../http.js';
import type {
  CreateThreadInput,
  ListThreadsParams,
  Thread,
  ThreadMessages,
  UpdateThreadInput,
} from '../types/thread.js';
import type { BulkDeleteResult } from '../types/bulkDelete.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * Threads (`/api/v1/developer/threads`) — a Thread's Subject is a person
 * chatting, so every call here requires this client to have been
 * constructed with `externalUserId` set (a bare Project credential has no
 * Subject to scope a conversation to; the server rejects it with 400
 * `EXTERNAL_USER_REQUIRED` otherwise).
 */
export class ThreadsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * `idempotencyKey`, if provided, is sent as the `Idempotency-Key` header —
   * a safe retry with the same key replays the original response instead
   * of creating a duplicate Thread.
   */
  async create(input: CreateThreadInput, idempotencyKey?: string): Promise<Thread> {
    return this.http.request<Thread>('POST', '/api/v1/developer/threads', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  async list(params: ListThreadsParams = {}): Promise<PaginatedResult<Thread>> {
    return this.http.request<PaginatedResult<Thread>>('GET', '/api/v1/developer/threads', {
      query: { ...params },
    });
  }

  async get(threadId: string): Promise<Thread> {
    return this.http.request<Thread>('GET', `/api/v1/developer/threads/${threadId}`);
  }

  /** General-purpose update — `{ title?, isArchived? }`. Send just `{ isArchived: true }` to
   * archive a Thread without touching its title. */
  async update(threadId: string, input: UpdateThreadInput): Promise<Thread> {
    return this.http.request<Thread>('PATCH', `/api/v1/developer/threads/${threadId}`, {
      body: input,
    });
  }

  /** Convenience wrapper over `update()` for the common title-only case. */
  async updateTitle(threadId: string, title: string): Promise<Thread> {
    return this.update(threadId, { title });
  }

  async delete(threadId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/threads/${threadId}`);
  }

  /** Best-effort batch delete — up to 100 ids per call; partial failures don't throw. */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/threads/bulk-delete', {
      body: { ids },
    });
  }

  async getMessages(threadId: string): Promise<ThreadMessages> {
    return this.http.request<ThreadMessages>(
      'GET',
      `/api/v1/developer/threads/${threadId}/messages`
    );
  }
}
