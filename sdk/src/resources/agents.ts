import type { HttpClient } from '../http.js';
import type {
  Agent,
  CreateAgentInput,
  DiscoverAgentsParams,
  UpdateAgentInput,
} from '../types/agent.js';

/**
 * Agents (`/api/v1/developer/agents`) — Project-owned, or, when this client
 * asserts an external user, owned by that end user.
 */
export class AgentsResource {
  constructor(private readonly http: HttpClient) {}

  async create(input: CreateAgentInput): Promise<Agent> {
    return this.http.request<Agent>('POST', '/api/v1/developer/agents', { body: input });
  }

  /** Note: returns a bare array — this endpoint has no pagination envelope. */
  async list(params: DiscoverAgentsParams = {}): Promise<Agent[]> {
    return this.http.request<Agent[]>('GET', '/api/v1/developer/agents', {
      query: { ...params },
    });
  }

  /** Populates `skills`/`mcps`/`knowledgeBases` as objects (unlike `create`/`update`/`list`). */
  async get(agentId: string): Promise<Agent> {
    return this.http.request<Agent>('GET', `/api/v1/developer/agents/${agentId}`);
  }

  async update(agentId: string, input: UpdateAgentInput): Promise<Agent> {
    return this.http.request<Agent>('PATCH', `/api/v1/developer/agents/${agentId}`, {
      body: input,
    });
  }

  async delete(agentId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/agents/${agentId}`);
  }
}
