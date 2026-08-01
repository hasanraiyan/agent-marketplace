import { HttpClient, type HttpClientOptions } from './http.js';
import type { PrincipalContext } from './types/principal.js';

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

  constructor(options: PersonaClientOptions) {
    this.http = new HttpClient(options);
  }

  /**
   * Resolves the principal context for the credential this client was
   * constructed with — a side-effect-free way to sanity-check auth wiring.
   */
  async whoami(): Promise<PrincipalContext> {
    return this.http.request<PrincipalContext>('GET', '/api/v1/developer/whoami');
  }
}
