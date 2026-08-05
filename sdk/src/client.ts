import { HttpClient, type HttpClientOptions } from './http.js';
import type { PrincipalContext } from './types/principal.js';
import { ProvidersResource } from './resources/providers.js';
import { SkillsResource } from './resources/skills.js';
import { AgentsResource } from './resources/agents.js';
import { KnowledgeResource } from './resources/knowledge.js';
import { McpsResource } from './resources/mcp.js';
import { ThreadsResource } from './resources/threads.js';
import { MemoryResource } from './resources/memory.js';
import { StoresResource } from './resources/stores.js';
import { FilesResource } from './resources/files.js';
import { AuditLogsResource } from './resources/auditLogs.js';
import { ChatClient } from './chat/chat-client.js';

export type PersonaClientOptions = HttpClientOptions;

/**
 * Entry point for the persona.hasanraiyan.me Developer Platform SDK.
 *
 * **Server-side only.** The credential this client holds is a server-side
 * secret (see the Integration Guide) — never construct this in a browser
 * bundle or a Next.js Client Component.
 */
export class PersonaClient {
  private readonly http: HttpClient;

  readonly providers: ProvidersResource;
  readonly skills: SkillsResource;
  readonly agents: AgentsResource;
  readonly knowledge: KnowledgeResource;
  readonly mcps: McpsResource;
  readonly threads: ThreadsResource;
  readonly memory: MemoryResource;
  readonly stores: StoresResource;
  readonly files: FilesResource;
  readonly auditLogs: AuditLogsResource;
  readonly chat: ChatClient;

  /**
   * @param options - `baseUrl` + `credential` are required. Set
   *   `externalUserId` to act on behalf of one of your own end users
   *   (required for `threads`/`files`/`chat`); omit it for Project-level
   *   (control-plane) calls only.
   * @example
   * ```ts
   * const client = new PersonaClient({
   *   baseUrl: 'https://api.persona.hasanraiyan.me',
   *   credential: process.env.PERSONA_CREDENTIAL!,
   * });
   * ```
   */
  constructor(options: PersonaClientOptions) {
    this.http = new HttpClient(options);
    this.providers = new ProvidersResource(this.http);
    this.skills = new SkillsResource(this.http);
    this.agents = new AgentsResource(this.http);
    this.knowledge = new KnowledgeResource(this.http);
    this.mcps = new McpsResource(this.http);
    this.threads = new ThreadsResource(this.http);
    this.memory = new MemoryResource(this.http);
    this.stores = new StoresResource(this.http);
    this.files = new FilesResource(this.http);
    this.auditLogs = new AuditLogsResource(this.http);
    this.chat = new ChatClient(this.http);
  }

  /**
   * Resolves the principal context for the credential this client was
   * constructed with — a side-effect-free way to sanity-check auth wiring.
   */
  async whoami(): Promise<PrincipalContext> {
    return this.http.request<PrincipalContext>('GET', '/api/v1/developer/whoami');
  }
}
