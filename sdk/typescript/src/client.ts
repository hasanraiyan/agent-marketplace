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
import { ArchitectClient } from './chat/architect-client.js';
import { createLogger, type Logger } from './logger.js';

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
  readonly architect: ArchitectClient;

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
    // Derive per-subsystem loggers so chat/architect streams have their own
    // namespace but share the caller's level/transport when a custom logger is supplied.
    // When `logger` is provided it is the parent; otherwise we create namespaced
    // loggers from the (optional) `logLevel` which falls back to the global level (off by default).
    const baseLogger: Logger | undefined = options.logger;
    const httpLogger: Logger = baseLogger
      ? baseLogger.child('http')
      : createLogger(
          'sdk:http',
          options.logLevel !== undefined ? { level: options.logLevel } : undefined
        );
    const chatLogger: Logger = baseLogger
      ? baseLogger.child('chat')
      : createLogger(
          'sdk:chat',
          options.logLevel !== undefined ? { level: options.logLevel } : undefined
        );
    const architectLogger: Logger = baseLogger
      ? baseLogger.child('architect')
      : createLogger(
          'sdk:architect',
          options.logLevel !== undefined ? { level: options.logLevel } : undefined
        );

    this.http = new HttpClient({ ...options, logger: httpLogger });
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
    this.chat = new ChatClient(this.http, chatLogger);
    this.architect = new ArchitectClient(this.http, architectLogger);
  }

  /**
   * Resolves the principal context for the credential this client was
   * constructed with — a side-effect-free way to sanity-check auth wiring.
   */
  async whoami(): Promise<PrincipalContext> {
    return this.http.request<PrincipalContext>('GET', '/api/v1/developer/whoami');
  }
}
