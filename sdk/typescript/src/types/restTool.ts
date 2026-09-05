export type RestToolMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type RestToolAuthType = 'none' | 'bearerSecret';
export type RestToolBodyMode = 'none' | 'json';
export type RestToolParamIn = 'path' | 'query' | 'header' | 'body';
export type RestToolParamType = 'string' | 'number' | 'boolean';

/** One query-string or header entry. `valueTemplate` may contain `{{token}}`. */
export interface RestToolParamRow {
  key: string;
  valueTemplate?: string;
  description?: string;
  /** @default true */
  required?: boolean;
}

/** Declares one agent-fillable `{{token}}` referenced in `url`/params/headers/body. */
export interface RestToolParamDescriptor {
  name: string;
  /** @default 'body' */
  in?: RestToolParamIn;
  /** @default 'string' */
  type?: RestToolParamType;
  description?: string;
  /** @default true */
  required?: boolean;
}

/** Reshapes the raw JSON response before the agent sees it, e.g. `{ field: 'name', path: '@data.user.name' }'. */
export interface RestToolResponseMapping {
  field: string;
  /** Must look like `"@data.field.path"`. */
  path: string;
}

/**
 * A no-code REST API tool an Agent can call. Goes through `toSafeJson()` —
 * `secretRef`'s underlying value is never returned, only `hasSecret`.
 */
export interface RestApiTool {
  _id: string;
  domain: string;
  ownerType: 'PersonaUser' | 'Project' | 'ExternalUser';
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  description?: string;
  method: RestToolMethod;
  url: string;
  queryParams: RestToolParamRow[];
  headers: RestToolParamRow[];
  bodyMode: RestToolBodyMode;
  bodyTemplate?: string;
  paramDescriptors: RestToolParamDescriptor[];
  authType: RestToolAuthType;
  /** Present only when `authType: 'bearerSecret'`. */
  secretRef?: string;
  hasSecret: boolean;
  responseMappings: RestToolResponseMapping[];
  isEnabled: boolean;
  lastTestedAt?: string | null;
  lastTestedStatus?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRestToolInput {
  name: string;
  description?: string;
  method: RestToolMethod;
  url: string;
  queryParams?: RestToolParamRow[];
  headers?: RestToolParamRow[];
  /** @default 'none' */
  bodyMode?: RestToolBodyMode;
  bodyTemplate?: string;
  paramDescriptors?: RestToolParamDescriptor[];
  /** @default 'none' */
  authType?: RestToolAuthType;
  /** Required when `authType: 'bearerSecret'` — a `ProjectSecret` id. */
  secretRef?: string;
  responseMappings?: RestToolResponseMapping[];
  /** @default true */
  isEnabled?: boolean;
}

/** All fields optional — only what you pass is changed. */
export type UpdateRestToolInput = Partial<CreateRestToolInput> & {
  /** `null` clears the secret (only meaningful alongside `authType: 'none'`). */
  secretRef?: string | null;
};

export interface DiscoverRestToolsParams {
  /** @default 1 */
  page?: number;
  /** @default 20 */
  limit?: number;
  /** Free-text match against `name`/`description`. */
  search?: string;
  /** Restricts to the asserted external user's own tools (`ProjectRuntimeContext` only). */
  scope?: 'mine';
}

export interface RestToolTestResult {
  status: number;
  ok: boolean;
  /** Raw JSON (or text) response body. */
  body: unknown;
  /** `body` reshaped by `responseMappings` — identical to what the agent receives. */
  mapped: unknown;
}

/** `testValues` stand in for agent-fillable args (and `externalUserId` if referenced) — never persisted, never usable by an agent. */
export interface TestRestToolInput {
  toolId?: string;
  draft?: Partial<CreateRestToolInput>;
  testValues?: Record<string, string>;
}
