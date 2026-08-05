export type StoreScope = 'domain' | 'externalUser';
export type StoreAccessMode = 'readonly' | 'readwrite';

/**
 * A named, scoped mount point assignable to Agents (`Agent.storeMounts`),
 * generalizing the fixed `/memories/user/`/`/memories/agent/` mounts into
 * arbitrarily-named ones. Mounted at `/stores/<name>/` in the Agent's
 * filesystem.
 */
export interface Store {
  _id: string;
  domain: string;
  name: string;
  description: string;
  /** `domain`: one shared namespace for the whole Project. `externalUser`:
   *  one namespace per external user, resolved per Agent run. Immutable
   *  after creation. */
  scope: StoreScope;
  /** `readonly`: Agents can read but never write via their own tool calls —
   *  content is populated only through this API. `readwrite`: Agents can
   *  also write_file/edit_file into it. */
  accessMode: StoreAccessMode;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreInput {
  name: string;
  description?: string;
  scope: StoreScope;
  /** @default 'readwrite' */
  accessMode?: StoreAccessMode;
}

/** `scope` is intentionally not included — immutable after creation. */
export interface UpdateStoreInput {
  name?: string;
  description?: string;
  accessMode?: StoreAccessMode;
}

export interface DiscoverStoresParams {
  /** @default 1 */
  page?: number;
  /** @default 20 */
  limit?: number;
  /** Free-text match against `name`. */
  search?: string;
}

export interface StoreFile {
  path: string;
  content: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetStoreFileParams {
  path: string;
}

export interface DeleteStoreFileParams {
  path: string;
}

export interface WriteStoreFileInput {
  path: string;
  content: string;
}
