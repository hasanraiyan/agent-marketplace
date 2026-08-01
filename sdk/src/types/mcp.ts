export type McpTransport = 'http' | 'sse';
export type McpAuthType = 'none' | 'oauth' | 'apiKey';
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
  tools: McpTool[];
  resources: McpResourceSummary[];
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
  authType?: McpAuthType;
  authMode?: McpAuthMode;
  /** Required when `authType: 'oauth'` and `useDynamicRegistration` isn't set. */
  oauth?: McpOAuthInput;
  /** Required when `authType: 'apiKey'`. */
  apiKey?: string;
  useDynamicRegistration?: boolean;
  isEnabled?: boolean;
}

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
  apiKey?: string;
}

export interface DiscoverMcpsParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Restricts to the asserted external user's own MCPs (ProjectRuntimeContext only). */
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
}
