import type { HttpClient } from '../http.js';
import type {
  CreateStoreInput,
  DeleteStoreFileParams,
  DiscoverStoresParams,
  GetStoreFileParams,
  Store,
  StoreFile,
  UpdateStoreInput,
  WriteStoreFileInput,
} from '../types/store.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * Stores (`/api/v1/developer/stores`) — named, scoped mount points you
 * create and assign to Agents (`Agent.storeMounts`, settable via
 * `agents.update()`), generalizing the fixed `/memories/user/`/
 * `/memories/agent/` mounts into arbitrarily-named ones.
 *
 * Config CRUD (`create`/`list`/`get`/`update`/`delete`) works with a bare
 * Project credential — a Store's config isn't per-founder. File CRUD is
 * the same, *except* when the Store's own `scope` is `'externalUser'`:
 * only then does this client need to have been constructed with
 * `externalUserId` set, or the call 400s with `EXTERNAL_USER_REQUIRED`.
 */
export class StoresResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new named Store.
   * @param input - `name`/`scope` are required. `scope` cannot be changed
   *   after creation.
   */
  async create(input: CreateStoreInput): Promise<Store> {
    return this.http.request<Store>('POST', '/api/v1/developer/stores', { body: input });
  }

  /**
   * Lists this Project's Stores.
   * @param params - `page` (default `1`), `limit` (default `20`), `search` (free-text against `name`).
   * @returns `{ items, pagination: { total, page, limit, pages } }`.
   */
  async list(params: DiscoverStoresParams = {}): Promise<PaginatedResult<Store>> {
    return this.http.request<PaginatedResult<Store>>('GET', '/api/v1/developer/stores', {
      query: { ...params },
    });
  }

  /**
   * Fetches a single Store's config by id.
   * @param storeId - The Store's `_id`.
   */
  async get(storeId: string): Promise<Store> {
    return this.http.request<Store>('GET', `/api/v1/developer/stores/${storeId}`);
  }

  /**
   * Updates a Store's `name`/`description`/`accessMode`. `scope` is not
   * updatable — create a new Store if you need a different one.
   * @param storeId - The Store's `_id`.
   */
  async update(storeId: string, input: UpdateStoreInput): Promise<Store> {
    return this.http.request<Store>('PATCH', `/api/v1/developer/stores/${storeId}`, {
      body: input,
    });
  }

  /**
   * Deletes a Store — also removes it from every Agent's `storeMounts` and
   * purges all of its data (every founder's partition, for an
   * `externalUser`-scoped Store).
   * @param storeId - The Store's `_id`.
   */
  async delete(storeId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/stores/${storeId}`);
  }

  /**
   * Lists files in a Store. For an `externalUser`-scoped Store, lists only
   * this client's asserted external user's own partition.
   * @param storeId - The Store's `_id`.
   */
  async listFiles(storeId: string): Promise<StoreFile[]> {
    const { files } = await this.http.request<{ files: StoreFile[] }>(
      'GET',
      `/api/v1/developer/stores/${storeId}/files`
    );
    return files;
  }

  /**
   * Reads one file from a Store.
   * @param storeId - The Store's `_id`.
   * @param params.path - The file's path.
   */
  async getFile(storeId: string, params: GetStoreFileParams): Promise<StoreFile> {
    return this.http.request<StoreFile>('GET', `/api/v1/developer/stores/${storeId}/file`, {
      query: { path: params.path },
    });
  }

  /**
   * Creates or overwrites one file in a Store. Not gated by the Store's
   * `accessMode` — `readonly` only blocks an Agent's own tool calls; this
   * is how a readonly Store's content actually gets populated.
   * @param storeId - The Store's `_id`.
   */
  async writeFile(storeId: string, input: WriteStoreFileInput): Promise<StoreFile> {
    return this.http.request<StoreFile>('PUT', `/api/v1/developer/stores/${storeId}/file`, {
      body: input,
    });
  }

  /**
   * Deletes one file from a Store.
   * @param storeId - The Store's `_id`.
   * @param params.path - The file's path.
   */
  async deleteFile(storeId: string, params: DeleteStoreFileParams): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/stores/${storeId}/file`, {
      query: { path: params.path },
    });
  }
}
