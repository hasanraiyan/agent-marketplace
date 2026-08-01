export interface SkillFile {
  path: string;
  content: string;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Note: unlike `Provider`, the Developer API returns Skill documents in
 * their raw Mongo shape (`_id`, not `id`) — reflected here as-is rather
 * than papering over a real backend inconsistency.
 */
export interface Skill {
  _id: string;
  domain: string;
  ownerType: 'PersonaUser' | 'Project' | 'ExternalUser';
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  description: string;
  instructions: string;
  files: SkillFile[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present only on `get()` — whether the calling identity owns this Skill. */
  isOwner?: boolean;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  instructions: string;
  isPublic?: boolean;
  files?: Array<{ path: string; content: string; mimeType?: string }>;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  instructions?: string;
  isPublic?: boolean;
  files?: Array<{ path: string; content: string; mimeType?: string }>;
}

export interface DiscoverSkillsParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Restricts to the asserted external user's own Skills (ProjectRuntimeContext only). */
  scope?: 'mine';
}
