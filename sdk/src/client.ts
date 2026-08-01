import { HttpClient, type HttpClientOptions } from './http.js';
import type { PrincipalContext } from './types/principal.js';
import { ProvidersResource } from './resources/providers.js';
import { SkillsResource } from './resources/skills.js';
import { AgentsResource } from './resources/agents.js';
import { KnowledgeResource } from './resources/knowledge.js';

export type PersonaClientOptions = HttpClientOptions;

/**
 * Entry point for the Persona.ai Developer Platform SDK.
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

  constructor(options: PersonaClientOptions) {
    this.http = new HttpClient(options);
    this.providers = new ProvidersResource(this.http);
    this.skills = new SkillsResource(this.http);
    this.agents = new AgentsResource(this.http);
    this.knowledge = new KnowledgeResource(this.http);
  }

  /**
   * Resolves the principal context for the credential this client was
   * constructed with — a side-effect-free way to sanity-check auth wiring.
   */
  async whoami(): Promise<PrincipalContext> {
    return this.http.request<PrincipalContext>('GET', '/api/v1/developer/whoami');
  }
}
