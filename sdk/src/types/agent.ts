export interface AgentSocialLinks {
  website?: string;
  twitter?: string;
  github?: string;
  linkedin?: string;
}

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
  slug: string;
  description?: string;
  avatar?: string;
  tags?: string[];
  tagline?: string;
  bio?: string;
  personalityTraits?: string[];
  socialLinks?: AgentSocialLinks;
  /** Stripped from the response when the calling identity doesn't own this Agent. */
  systemPrompt?: string;
  /** Stripped from the response when the calling identity doesn't own this Agent. */
  providerId?: string;
  modelName?: string;
  webSearchEnabled: boolean;
  visibility: AgentVisibility;
  category: AgentCategory;
  skills?: unknown[];
  mcps?: unknown[];
  knowledgeBases?: unknown[];
  isActive: boolean;
  isMainAgent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  systemPrompt: string;
  providerId: string;
  description?: string;
  avatar?: string;
  tags?: string[];
  tagline?: string;
  bio?: string;
  personalityTraits?: string[];
  socialLinks?: AgentSocialLinks;
  modelName?: string;
  webSearchEnabled?: boolean;
  visibility?: AgentVisibility;
  category?: AgentCategory;
  skills?: string[];
  mcps?: string[];
  knowledgeBases?: string[];
  isActive?: boolean;
}

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
  skills?: string[];
  mcps?: string[];
  knowledgeBases?: string[];
  visibility?: AgentVisibility;
  category?: AgentCategory;
  isActive?: boolean;
}

export interface DiscoverAgentsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: AgentCategory;
  /** Restricts to the asserted external user's own Agents (ProjectRuntimeContext only). */
  scope?: 'mine';
}
