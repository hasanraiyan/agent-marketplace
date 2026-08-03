import type { HttpClient } from '../http.js';
import type {
  CreateThreadInput,
  ListThreadsParams,
  Thread,
  ThreadMessages,
  UpdateThreadInput,
} from '../types/thread.js';

/**
 * Threads (`/api/v1/developer/threads`) — a Thread's Subject is a person
 * chatting, so every call here requires this client to have been
 * constructed with `externalUserId` set (a bare Project credential has no
 * Subject to scope a conversation to; the server rejects it with 400
 * `EXTERNAL_USER_REQUIRED` otherwise).
 */
export class ThreadsResource {
  constructor(private readonly http: HttpClient) {}

  async create(input: CreateThreadInput): Promise<Thread> {
    return this.http.request<Thread>('POST', '/api/v1/developer/threads', { body: input });
  }

  /** Note: returns a bare array — this endpoint has no pagination envelope. */
  async list(params: ListThreadsParams = {}): Promise<Thread[]> {
    return this.http.request<Thread[]>('GET', '/api/v1/developer/threads', {
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

  async getMessages(threadId: string): Promise<ThreadMessages> {
    return this.http.request<ThreadMessages>(
      'GET',
      `/api/v1/developer/threads/${threadId}/messages`
    );
  }
}
