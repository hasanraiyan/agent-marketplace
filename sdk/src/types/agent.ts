export interface AgentSocialLinks {
  website?: string;
  twitter?: string;
  github?: string;
  linkedin?: string;
}

/** `unlisted` is reachable by direct link/id but excluded from public discovery listings. */
export type AgentVisibility = 'private' | 'unlisted' | 'public';
export type AgentCategory =
  'productivity' | 'coding' | 'creative' | 'research' | 'roleplay' | 'other';

/**
 * Note: like `Skill`, this mirrors the real wire shape (`_id`, raw
 * domain/ownerType fields) — `getOne()` returns `skills`/`mcps`/
 * `knowledgeBases` populated as objects, while `create()`/`update()`/
 * `list()` return them as bare id strings; typed loosely here to reflect
 * that real difference rather than picking one shape and being wrong for
 * the other calls.
 */
export interface Agent {
  _id: string;
  domain: string;
  ownerType: 'PersonaUser' | 'Project' | 'ExternalUser';
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  /** URL-safe, unique within the Domain; used in some public-facing routes. */
  slug: string;
  description?: string;
  avatar?: string;
  tags?: string[];
  /** Short one-liner shown in list/card views. */
  tagline?: string;
  /** Longer free-text bio shown on the Agent's own profile view. */
  bio?: string;
  personalityTraits?: string[];
  socialLinks?: AgentSocialLinks;
  /** Stripped from the response when the calling identity doesn't own this Agent. */
  systemPrompt?: string;
  /** Stripped from the response when the calling identity doesn't own this Agent. */
  providerId?: string;
  /** Overrides the referenced Provider's `defaultModel` when set. */
  modelName?: string;
  webSearchEnabled: boolean;
  visibility: AgentVisibility;
  category: AgentCategory;
  /** Bare id strings on `create`/`update`/`list`; populated objects on `get()`. */
  skills?: unknown[];
  /** Bare id strings on `create`/`update`/`list`; populated objects on `get()`. */
  mcps?: unknown[];
  /** Bare id strings on `create`/`update`/`list`; populated objects on `get()`. */
  knowledgeBases?: unknown[];
  isActive: boolean;
  /** Whether this is the Project's designated default/primary Agent. */
  isMainAgent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  /** The instructions that define this Agent's behavior/persona. */
  systemPrompt: string;
  /** Must reference a Provider already created via `providers.create()`. */
  providerId: string;
  description?: string;
  avatar?: string;
  tags?: string[];
  tagline?: string;
  bio?: string;
  personalityTraits?: string[];
  socialLinks?: AgentSocialLinks;
  /** Overrides the referenced Provider's `defaultModel`. */
  modelName?: string;
  /** @default false */
  webSearchEnabled?: boolean;
  /** @default 'private' */
  visibility?: AgentVisibility;
  /** @default 'other' */
  category?: AgentCategory;
  /** Skill ids to attach at creation time. */
  skills?: string[];
  /** MCP server ids to attach at creation time. */
  mcps?: string[];
  /** Knowledge base ids to attach at creation time. */
  knowledgeBases?: string[];
  /** @default true */
  isActive?: boolean;
}

/** All fields optional — only what you pass is changed. */
export interface UpdateAgentInput {
  name?: string;
  description?: string;
  avatar?: string;
  tags?: string[];
  tagline?: string;
  bio?: string;
  personalityTraits?: string[];
  socialLinks?: AgentSocialLinks;
  systemPrompt?: string;
  providerId?: string;
  modelName?: string;
  webSearchEnabled?: boolean;
  /** Replaces the entire array — this is not a merge/append. */
  skills?: string[];
  /** Replaces the entire array — this is not a merge/append. */
  mcps?: string[];
  /** Replaces the entire array — this is not a merge/append. */
  knowledgeBases?: string[];
  visibility?: AgentVisibility;
  category?: AgentCategory;
  isActive?: boolean;
}

export interface DiscoverAgentsParams {
  /** @default 1 */
  page?: number;
  /** @default 20 */
  limit?: number;
  /** Free-text match against `name`/`description`/`tagline`. */
  search?: string;
  category?: AgentCategory;
  /** Restricts to the asserted external user's own Agents (`ProjectRuntimeContext` only). */
  scope?: 'mine';
}
