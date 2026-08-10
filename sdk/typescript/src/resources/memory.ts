import type { HttpClient } from '../http.js';
import type {
  DeleteMemoryFileParams,
  GetMemoryFileParams,
  MemoryFile,
  MemoryListResult,
  WriteMemoryFileInput,
} from '../types/memory.js';

/**
 * Memory (`/api/v1/developer/memory`) — a subject's memory files are the
 * same `/memories/user/`/`/memories/agent/` filesystem an Agent's own
 * `write_file`/`read_file` tool calls see, exposed over REST. Every call
 * here requires this client to have been constructed with `externalUserId`
 * set (a bare Project credential has no Subject to scope memory to; the
 * server rejects it with 400 `EXTERNAL_USER_REQUIRED` otherwise).
 */
export class MemoryResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists every memory file for the asserted external user: user-global
   * files plus one group per Agent that has agent-scoped memory.
   */
  async list(): Promise<MemoryListResult> {
    return this.http.request<MemoryListResult>('GET', '/api/v1/developer/memory');
  }

  /**
   * Reads one memory file.
   * @param params.path - The file's path, e.g. `/memories/user/index.md`.
   * @param params.scope - `'user'` (default) or `'agent'`.
   * @param params.agentId - Required when `scope` is `'agent'`.
   */
  async getFile(params: GetMemoryFileParams): Promise<MemoryFile> {
    return this.http.request<MemoryFile>('GET', '/api/v1/developer/memory/file', {
      query: { path: params.path, scope: params.scope, agentId: params.agentId },
    });
  }

  /**
   * Creates or overwrites one memory file.
   * @param input.path - The file's path, e.g. `/memories/user/preferences.md`.
   * @param input.content - The file's full content (overwrites any existing content).
   * @param input.scope - `'user'` (default) or `'agent'`.
   * @param input.agentId - Required when `scope` is `'agent'`.
   */
  async writeFile(input: WriteMemoryFileInput): Promise<MemoryFile> {
    return this.http.request<MemoryFile>('PUT', '/api/v1/developer/memory/file', {
      body: input,
    });
  }

  /**
   * Deletes one memory file.
   * @param params.path - The file's path.
   * @param params.scope - `'user'` (default) or `'agent'`.
   * @param params.agentId - Required when `scope` is `'agent'`.
   */
  async deleteFile(params: DeleteMemoryFileParams): Promise<void> {
    await this.http.request<unknown>('DELETE', '/api/v1/developer/memory/file', {
      query: { path: params.path, scope: params.scope, agentId: params.agentId },
    });
  }
}
