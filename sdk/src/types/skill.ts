/** A file bundled with a Skill (e.g. a reference doc or script an Agent can read). */
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
  /** Visible to every credential in the platform when `true`, not just this Domain. */
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present only on `get()` — whether the calling identity owns this Skill. */
  isOwner?: boolean;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  /** The actual prompt text given to an Agent that has this Skill attached. */
  instructions: string;
  /** @default false */
  isPublic?: boolean;
  files?: Array<{ path: string; content: string; mimeType?: string }>;
}

/** All fields optional — only what you pass is changed. */
export interface UpdateSkillInput {
  name?: string;
  description?: string;
  instructions?: string;
  isPublic?: boolean;
  /** Replaces the entire `files` array — this is not a merge/append. */
  files?: Array<{ path: string; content: string; mimeType?: string }>;
}

export interface DiscoverSkillsParams {
  /** @default 1 */
  page?: number;
  /** @default 20 */
  limit?: number;
  /** Free-text match against `name`/`description`. */
  search?: string;
  /** Restricts to the asserted external user's own Skills (`ProjectRuntimeContext` only). */
  scope?: 'mine';
}
