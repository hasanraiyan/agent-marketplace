export type McpTransport = 'http' | 'sse';
export type McpAuthType = 'none' | 'oauth' | 'apiKey';
/** `owner`: one shared connection for the whole Project. `user`: each external user connects their own. */
export type McpAuthMode = 'owner' | 'user';

export interface McpTool {
  name: string;
  description: string;
}

export interface McpResourceSummary {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/** A resource whose `uri` has placeholder params to fill before calling `readResource()`. */
export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
  toolName: string;
}

export interface McpOAuthConfig {
  clientId: string | null;
  hasClientSecret: boolean;
  authorizationEndpoint: string | null;
  tokenEndpoint: string | null;
  scopes: string[];
  dynamicallyRegistered: boolean;
  /** Whether the MCP's owner has completed the owner-mode OAuth flow. */
  ownerConnected: boolean;
}

/**
 * Like Provider (not Skill/Agent/Knowledge), this goes through a clean
 * `toSafeJson()` DTO — `oauth`/`apiKeyEncrypted` are stripped in favor of
 * `hasApiKey`/a summarized `oauth` object. Still `_id`-shaped, though
 * (`toSafeJson` spreads the raw document minus secrets, doesn't rename it).
 */
export interface Mcp {
  _id: string;
  domain: string;
  ownerType: 'PersonaUser' | 'Project' | 'ExternalUser';
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  description?: string;
  transport: McpTransport;
  url: string;
  authType: McpAuthType;
  authMode: McpAuthMode;
  hasApiKey: boolean;
  oauth?: McpOAuthConfig;
  isEnabled: boolean;
  /** Populated by `testConnection()`; empty until it's been called at least once. */
  tools: McpTool[];
  /** Populated by `testConnection()`; empty until it's been called at least once. */
  resources: McpResourceSummary[];
  /** Populated by `testConnection()`; empty until it's been called at least once. */
  resourceTemplates: McpResourceTemplate[];
  createdAt: string;
  updatedAt: string;
}

export interface McpOAuthInput {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}

export interface CreateMcpInput {
  name: string;
  transport: McpTransport;
  url: string;
  description?: string;
  /** @default 'none' */
  authType?: McpAuthType;
  /** @default 'owner' */
  authMode?: McpAuthMode;
  /** Required when `authType: 'oauth'` and `useDynamicRegistration` isn't set. */
  oauth?: McpOAuthInput;
  /** Required when `authType: 'apiKey'`. Sent as a static bearer token — always owner-shared, regardless of `authMode`. */
  apiKey?: string;
  /** Use RFC 7591 Dynamic Client Registration instead of a manually-configured `oauth` block. @default false */
  useDynamicRegistration?: boolean;
  /** @default true */
  isEnabled?: boolean;
}

/** All fields optional — only what you pass is changed. */
export interface UpdateMcpInput {
  name?: string;
  description?: string;
  transport?: McpTransport;
  url?: string;
  authType?: McpAuthType;
  authMode?: McpAuthMode;
  isEnabled?: boolean;
  useDynamicRegistration?: boolean;
  oauth?: Partial<McpOAuthInput>;
  /** Replaces the stored key entirely; omit to leave the existing key untouched. */
  apiKey?: string;
}

export interface DiscoverMcpsParams {
  /** @default 1 */
  page?: number;
  /** @default 20 */
  limit?: number;
  /** Free-text match against `name`/`description`. */
  search?: string;
  /** Restricts to the asserted external user's own MCPs (`ProjectRuntimeContext` only). */
  scope?: 'mine';
}

export interface McpTestConnectionResult {
  tools: McpTool[];
  resources: McpResourceSummary[];
  resourceTemplates: McpResourceTemplate[];
}

export interface McpReadResourceResult {
  text: string;
  mimeType: string;
}

export interface McpUserConnectionStatus {
  connected: boolean;
  /** Finer-grained than `connected`; absent against backends predating this field. */
  status?: McpConnectionStatus;
  /** ISO timestamp of the stored access token's expiry, when the provider returned one. */
  expiresAt?: string | null;
  /** The provider's rejection reason when `status` is `needs_auth`. Never contains tokens. */
  lastError?: string | null;
}

/**
 * Why a user-mode MCP isn't usable:
 * - `connected` — a usable token row exists.
 * - `expired` — access token dead and no refresh token to renew it.
 * - `needs_auth` — the provider rejected the stored grant; reconnect is the only fix.
 * - `not_connected` — this user has never connected.
 */
export type McpConnectionStatus = 'connected' | 'expired' | 'needs_auth' | 'not_connected';
