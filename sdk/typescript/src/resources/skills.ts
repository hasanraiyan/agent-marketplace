import type { HttpClient } from '../http.js';
import type {
  CreateSkillInput,
  DiscoverSkillsParams,
  Skill,
  UpdateSkillInput,
} from '../types/skill.js';
import type { ResourceUsage } from '../types/usage.js';
import type { BulkDeleteResult } from '../types/bulkDelete.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * Skills (`/api/v1/developer/skills`) — Project-owned or, when this client
 * asserts an external user, owned by that end user.
 */
export class SkillsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new Skill (a reusable instruction + optional file bundle an
   * Agent can be given).
   * @param input - `name`/`description`/`instructions` are required.
   * @param idempotencyKey - Optional. Sent as the `Idempotency-Key` header —
   *   a safe retry with the same key replays the original response instead
   *   of creating a duplicate Skill.
   * @returns The created {@link Skill} (raw Mongo shape — `_id`, not `id`).
   */
  async create(input: CreateSkillInput, idempotencyKey?: string): Promise<Skill> {
    return this.http.request<Skill>('POST', '/api/v1/developer/skills', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /**
   * Lists/searches Skills visible to this credential (this Project's own,
   * plus any public Skills).
   * @param params - `page` (default `1`), `limit` (default `20`), `search`
   *   (free-text), `scope: 'mine'` (restricts to the asserted external
   *   user's own Skills — `ProjectRuntimeContext` only).
   * @returns `{ items, pagination: { total, page, limit, pages } }`.
   * @example
   * ```ts
   * const { items, pagination } = await client.skills.list({ search: 'summarize', limit: 50 });
   * ```
   */
  async list(params: DiscoverSkillsParams = {}): Promise<PaginatedResult<Skill>> {
    return this.http.request<PaginatedResult<Skill>>('GET', '/api/v1/developer/skills', {
      query: { ...params },
    });
  }

  /**
   * Fetches a single Skill by id.
   * @param skillId - The Skill's `_id`.
   */
  async get(skillId: string): Promise<Skill> {
    return this.http.request<Skill>('GET', `/api/v1/developer/skills/${skillId}`);
  }

  /**
   * Partially updates a Skill — only the fields you pass are changed.
   * @param skillId - The Skill's `_id`.
   * @param input - Any subset of `name`/`description`/`instructions`/`isPublic`/`files`.
   */
  async update(skillId: string, input: UpdateSkillInput): Promise<Skill> {
    return this.http.request<Skill>('PATCH', `/api/v1/developer/skills/${skillId}`, {
      body: input,
    });
  }

  /**
   * Deletes a Skill. Rejects with `PersonaApiError` if any Agent still
   * references it — call {@link SkillsResource.getUsage} first to check.
   * @param skillId - The Skill's `_id`.
   */
  async delete(skillId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/skills/${skillId}`);
  }

  /**
   * Agents referencing this Skill — check before {@link SkillsResource.delete}
   * to avoid a blocked-delete error.
   * @param skillId - The Skill's `_id`.
   * @returns `agentCount` is the real total; `agents` is a preview capped at 20.
   */
  async getUsage(skillId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>('GET', `/api/v1/developer/skills/${skillId}/usage`);
  }

  /**
   * Best-effort batch delete — partial failures (e.g. a Skill still
   * referenced by an Agent) don't throw or abort the rest of the batch.
   * @param ids - Up to 100 Skill ids per call.
   * @returns `{ deleted, failed }` — check `failed` for per-id reasons.
   */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/skills/bulk-delete', {
      body: { ids },
    });
  }
}
