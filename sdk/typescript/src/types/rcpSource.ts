export interface RcpSourceToolParamSummary {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

/** A display cache only, written by `testConnection()` — Agent execution discovers tools live via `rcp-sdk`, never reads this. */
export interface RcpSourceToolSummary {
  name: string;
  description: string;
  method: string;
  url: string;
  /** Every param this tool exposes (never resolver-filtered) — needed client-side to build `paramContextMap`. */
  params: RcpSourceToolParamSummary[];
}

/** Maps one of this source's tool param names to a key an agent's caller sends in a message's per-turn `context` object — see `SendMessageOptions.context`. Shared across every Agent this source is attached to, not per-attachment. */
export interface RcpParamContextMapEntry {
  param: string;
  contextKey: string;
}

/**
 * A hosted RCP (REST Connector Protocol, npm `rcp-sdk`) manifest URL Persona
 * discovers tools from live on every Agent run. Independent of REST Tool
 * Sources — same shape, different protocol.
 */
export interface RcpSource {
  _id: string;
  domain: string;
  ownerType: 'PersonaUser' | 'Project' | 'ExternalUser';
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  description: string;
  /** `GET url` must return a conformant `{ rcpVersion, auth, tools[] }` manifest. */
  url: string;
  authType: 'none' | 'header';
  /** A Project Secret id — present only when `authType` is `'header'`. Never returns the secret's plaintext value. */
  secretRef?: string | null;
  isEnabled: boolean;
  lastTestedAt?: string | null;
  /** Populated by `testConnection()` — see {@link RcpSourceToolSummary}. */
  tools: RcpSourceToolSummary[];
  paramContextMap: RcpParamContextMapEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRcpSourceInput {
  name: string;
  description?: string;
  url: string;
  /** @default 'none' */
  authType?: 'none' | 'header';
  /** A Project Secret id. Required when `authType` is `'header'`. */
  secretRef?: string;
  /** @default true */
  isEnabled?: boolean;
  paramContextMap?: RcpParamContextMapEntry[];
}

/** All fields optional — only what you pass is changed. */
export interface UpdateRcpSourceInput {
  name?: string;
  description?: string;
  url?: string;
  authType?: 'none' | 'header';
  secretRef?: string | null;
  isEnabled?: boolean;
  paramContextMap?: RcpParamContextMapEntry[];
}

export interface DiscoverRcpSourcesParams {
  /** @default 1 */
  page?: number;
  /** @default 20 */
  limit?: number;
  /** Free-text match against `name`. */
  search?: string;
}

/** From `testConnection()` — discovers the source's manifest live via `rcp-sdk` and persists it as the new display cache. */
export interface RcpSourceTestConnectionResult {
  tools: RcpSourceToolSummary[];
}
