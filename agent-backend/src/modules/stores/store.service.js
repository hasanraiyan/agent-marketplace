import storeRepository from './store.repository.js';
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import MemoryFile from '../memory/memory-file.model.js';
import { normalizeMemoryKey } from '../memory/memory-files-store.js';
import { domainStoreNamespace, externalUserStoreNamespace } from './storeNamespace.js';
import { scopedFilter } from '../../utils/domainQuery.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

const EXTERNAL_USER_REQUIRED_MESSAGE =
  'This store requires an asserted external user (x-persona-external-user-id)';

function toFileDto(doc) {
  return {
    path: doc.key,
    content: doc.content,
    mimeType: doc.mimeType,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Config CRUD + file CRUD for named Stores. File CRUD reuses the same
 * `MemoryFile` collection/`normalizeMemoryKey` helper `memory.service.js`
 * uses — a different first namespace segment (`'stores'` vs `'users'`)
 * means the two never collide, so no new storage engine is needed.
 */
class StoreService {
  async createStore(domain, data) {
    return await storeRepository.create({ ...data, domain });
  }

  _buildFilter(domain, filters = {}) {
    const extra = {};
    if (filters.search) extra.name = { $regex: filters.search, $options: 'i' };
    return scopedFilter(domain, extra);
  }

  async listStores(domain, filters, pagination) {
    return await storeRepository.search(this._buildFilter(domain, filters), pagination);
  }

  async countStores(domain, filters) {
    return await storeRepository.count(this._buildFilter(domain, filters));
  }

  async getStoreById(domain, storeId) {
    const store = await storeRepository.findById(storeId);
    if (!store || store.domain !== domain) throw new Error('Store not found');
    return store;
  }

  /** `scope` is intentionally stripped — immutable after creation (see store.model.js). */
  async updateStore(domain, storeId, updateData) {
    const patch = { ...updateData };
    delete patch.domain;
    delete patch.scope;

    const store = await storeRepository.update(storeId, { domain }, patch);

    const agents = await agentRepository.findAgentsUsingStore(storeId, '_id');
    for (const agent of agents) agentFactory.invalidate(agent._id);

    return store;
  }

  async deleteStore(domain, storeId) {
    const store = await this.getStoreById(domain, storeId);

    const agents = await agentRepository.findAgentsUsingStore(storeId, '_id');
    await agentRepository.removeStoreFromAgents(storeId);
    for (const agent of agents) agentFactory.invalidate(agent._id);

    // Purge every founder's partition too when the store is externalUser-
    // scoped (namespace.2 is the externalUserId, intentionally unconstrained).
    const purgeFilter =
      store.scope === 'externalUser'
        ? { 'namespace.0': 'stores', 'namespace.1': store.domain, 'namespace.3': store.name }
        : { 'namespace.0': 'stores', 'namespace.1': store.domain, 'namespace.2': store.name };
    await MemoryFile.deleteMany(purgeFilter);

    await storeRepository.delete(storeId, { domain });
    logger.info(`[StoreService] Deleted store "${store.name}" (${storeId}) in domain ${domain}`);
  }

  _namespaceFor(store, externalUserId) {
    if (store.scope === 'externalUser') {
      if (!externalUserId) throw new Error(EXTERNAL_USER_REQUIRED_MESSAGE);
      return externalUserStoreNamespace(store.domain, externalUserId, store.name);
    }
    return domainStoreNamespace(store.domain, store.name);
  }

  async listStoreFiles(domain, storeId, externalUserId) {
    const store = await this.getStoreById(domain, storeId);
    const namespace = this._namespaceFor(store, externalUserId);
    const docs = await MemoryFile.find({ namespace }).sort({ key: 1 });
    return docs.map(toFileDto);
  }

  async getStoreFile(domain, storeId, externalUserId, path) {
    const store = await this.getStoreById(domain, storeId);
    const namespace = this._namespaceFor(store, externalUserId);
    const key = normalizeMemoryKey(path);

    const doc = await MemoryFile.findOne({ namespace, key });
    if (!doc) throw new Error('Store file not found');
    return toFileDto(doc);
  }

  /** Not gated by accessMode: readonly only blocks agent tool writes (enforced
   * at mount time in agent.factory.js) — this is how a readonly store's
   * content actually gets populated in the first place. */
  async writeStoreFile(domain, storeId, externalUserId, { path, content }) {
    const store = await this.getStoreById(domain, storeId);
    const namespace = this._namespaceFor(store, externalUserId);
    const key = normalizeMemoryKey(path);

    const doc = await MemoryFile.findOneAndUpdate(
      { namespace, key },
      { $set: { content: String(content ?? ''), mimeType: 'text/markdown' } },
      { upsert: true, new: true }
    );
    logger.info(`[StoreService] Wrote file to store "${store.name}": ${key}`);
    return toFileDto(doc);
  }

  async deleteStoreFile(domain, storeId, externalUserId, path) {
    const store = await this.getStoreById(domain, storeId);
    const namespace = this._namespaceFor(store, externalUserId);
    const key = normalizeMemoryKey(path);

    const result = await MemoryFile.deleteOne({ namespace, key });
    if (result.deletedCount === 0) throw new Error('Store file not found');
    logger.info(`[StoreService] Deleted file from store "${store.name}": ${key}`);
  }
}

export default new StoreService();
export { EXTERNAL_USER_REQUIRED_MESSAGE };
