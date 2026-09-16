import type { HttpClient } from '../http.js';
import type {
  CreateThreadInput,
  ListThreadsParams,
  Thread,
  ThreadMessages,
  UpdateThreadInput,
  WorkspaceFile,
  WorkspaceFiles,
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
   * Creates a new conversation Thread for the asserted external user with
   * the given Agent. You don't need to call this before chatting — `chat.sendMessage()`/
   * `chat.stream()` create an implicit deterministic Thread automatically; call
   * this only when you want an explicit, listable Thread up front.
   * @param input - `{ agentId }`.
   * @param idempotencyKey - Optional. Sent as the `Idempotency-Key` header —
   *   a safe retry with the same key replays the original response instead
   *   of creating a duplicate Thread.
   * @returns The created {@link Thread} (raw Mongo shape — `_id`, not `id`).
   */
  async create(input: CreateThreadInput, idempotencyKey?: string): Promise<Thread> {
    return this.http.request<Thread>('POST', '/api/v1/developer/threads', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /**
   * Lists the asserted external user's own Threads, most recently active first.
   * @param params - `page` (default `1`), `limit` (default `20`).
   * @returns `{ items, pagination: { total, page, limit, pages } }`. Each
   *   item's `agentId` is populated as `{ _id, name, avatar, slug }` here
   *   (unlike `create()`/`get()`, which return a bare id string).
   */
  async list(params: ListThreadsParams = {}): Promise<PaginatedResult<Thread>> {
    return this.http.request<PaginatedResult<Thread>>('GET', '/api/v1/developer/threads', {
      query: { ...params },
    });
  }

  /**
   * Fetches a single Thread by id.
   * @param threadId - The Thread's `_id`.
   */
  async get(threadId: string): Promise<Thread> {
    return this.http.request<Thread>('GET', `/api/v1/developer/threads/${threadId}`);
  }

  /**
   * General-purpose update — `{ title?, isArchived? }`. Send just
   * `{ isArchived: true }` to archive a Thread without touching its title.
   * @param threadId - The Thread's `_id`.
   */
  async update(threadId: string, input: UpdateThreadInput): Promise<Thread> {
    return this.http.request<Thread>('PATCH', `/api/v1/developer/threads/${threadId}`, {
      body: input,
    });
  }

  /**
   * Convenience wrapper over {@link ThreadsResource.update} for the common
   * title-only case.
   * @param threadId - The Thread's `_id`.
   * @param title - The new title.
   */
  async updateTitle(threadId: string, title: string): Promise<Thread> {
    return this.update(threadId, { title });
  }

  /**
   * Deletes a Thread and its message history.
   * @param threadId - The Thread's `_id`.
   */
  async delete(threadId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/threads/${threadId}`);
  }

  /**
   * Clears a Thread's conversation content in place — message history,
   * workspace files/todos, and subagent traces — while keeping the Thread
   * itself (same `_id`/`threadId`/title). Use this to let a caller start a
   * fresh conversation without losing the Thread's identity the way
   * {@link ThreadsResource.delete} + {@link ThreadsResource.create} would
   * (a new Thread means a new id, breaking anything that held onto the
   * old one). Long-term agent memory is not affected.
   * @param threadId - The Thread's `_id`.
   * @returns The reset {@link Thread}.
   */
  async reset(threadId: string): Promise<Thread> {
    return this.http.request<Thread>('POST', `/api/v1/developer/threads/${threadId}/reset`);
  }

  /**
   * Best-effort batch delete — partial failures don't throw or abort the
   * rest of the batch.
   * @param ids - Up to 100 Thread ids per call.
   * @returns `{ deleted, failed }` — check `failed` for per-id reasons.
   */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/threads/bulk-delete', {
      body: { ids },
    });
  }

  /**
   * Fetches the full message history + graph state for a Thread — the same
   * data `chat.stream()` would resume from.
   * @param threadId - The Thread's `_id`.
   */
  async getMessages(threadId: string): Promise<ThreadMessages> {
    return this.http.request<ThreadMessages>(
      'GET',
      `/api/v1/developer/threads/${threadId}/messages`
    );
  }

  /**
   * Lists a Thread's workspace files (the agent's own virtual filesystem) —
   * the same data embedded in `getMessages()`'s `state.files`, as a
   * lighter, dedicated read for a caller that only wants the files.
   * @param threadId - The Thread's `_id`.
   */
  async listFiles(threadId: string): Promise<WorkspaceFiles> {
    return this.http.request<WorkspaceFiles>(
      'GET',
      `/api/v1/developer/threads/${threadId}/files`
    );
  }

  /**
   * Fetches one workspace file's content and metadata.
   * @param threadId - The Thread's `_id`.
   * @param path - The file's absolute path, e.g. `/notes.md`.
   */
  async getFile(threadId: string, path: string): Promise<WorkspaceFile> {
    return this.http.request<WorkspaceFile>(
      'GET',
      `/api/v1/developer/threads/${threadId}/file`,
      { query: { path } }
    );
  }

  /**
   * Creates or overwrites one workspace file. Writes directly into the
   * Thread's live agent checkpoint — KNOWN LIMITATION: no lock exists
   * against a concurrent live run on this same Thread, so a write here
   * while the agent is actively mid-run could race with its own file
   * writes.
   * @param threadId - The Thread's `_id`.
   * @param path - The file's absolute path. Paths under `/skills/` are
   *   rejected (system-seeded, not writable).
   * @param content - The full new file content (this replaces the file,
   *   it does not append).
   */
  async writeFile(threadId: string, path: string, content: string): Promise<WorkspaceFile> {
    return this.http.request<WorkspaceFile>(
      'PUT',
      `/api/v1/developer/threads/${threadId}/file`,
      { body: { path, content } }
    );
  }

  /**
   * Deletes one workspace file. Same live-checkpoint write and concurrency
   * caveat as {@link ThreadsResource.writeFile}.
   * @param threadId - The Thread's `_id`.
   * @param path - The file's absolute path.
   */
  async deleteFile(threadId: string, path: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/threads/${threadId}/file`, {
      query: { path },
    });
  }
}
