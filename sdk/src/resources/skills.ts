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
   * `idempotencyKey`, if provided, is sent as the `Idempotency-Key` header —
   * a safe retry with the same key replays the original response instead
   * of creating a duplicate Skill.
   */
  async create(input: CreateSkillInput, idempotencyKey?: string): Promise<Skill> {
    return this.http.request<Skill>('POST', '/api/v1/developer/skills', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  async list(params: DiscoverSkillsParams = {}): Promise<PaginatedResult<Skill>> {
    return this.http.request<PaginatedResult<Skill>>('GET', '/api/v1/developer/skills', {
      query: { ...params },
    });
  }

  async get(skillId: string): Promise<Skill> {
    return this.http.request<Skill>('GET', `/api/v1/developer/skills/${skillId}`);
  }

  async update(skillId: string, input: UpdateSkillInput): Promise<Skill> {
    return this.http.request<Skill>('PATCH', `/api/v1/developer/skills/${skillId}`, {
      body: input,
    });
  }

  async delete(skillId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/skills/${skillId}`);
  }

  /** Agents referencing this Skill — check before `delete()` to avoid a blocked-delete error. */
  async getUsage(skillId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>('GET', `/api/v1/developer/skills/${skillId}/usage`);
  }

  /** Best-effort batch delete — up to 100 ids per call; partial failures don't throw. */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/skills/bulk-delete', {
      body: { ids },
    });
  }
}
