import Store from './store.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';

class StoreRepository {
  async create(storeData) {
    const store = new Store(storeData);
    return await store.save();
  }

  async findById(id) {
    return await Store.findById(id);
  }

  /** Domain-scoped find — `filter` must already include `domain` (see `scopedFilter`). */
  async search(filter, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await Store.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit);
  }

  async count(filter) {
    return await Store.countDocuments(filter);
  }

  /** Atomic, domain-scoped — `domainFilter` must already include `domain`. */
  async update(id, domainFilter, updateData) {
    const store = await Store.findOneAndUpdate(
      { _id: id, ...domainFilter },
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );
    if (!store) throw new NotFoundError('Store not found');
    return store;
  }

  async delete(id, domainFilter) {
    const store = await Store.findOneAndDelete({ _id: id, ...domainFilter });
    if (!store) throw new NotFoundError('Store not found');
    return store;
  }

  async deleteManyByDomain(domain) {
    return await Store.deleteMany({ domain });
  }
}

export default new StoreRepository();
