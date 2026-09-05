import RcpSource from './rcpSource.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';

class RcpSourceRepository {
  async create(data) {
    const source = new RcpSource(data);
    return await source.save();
  }

  async findById(id) {
    return await RcpSource.findById(id);
  }

  /** See restApiToolSource.repository.js's `update`'s doc comment — identical `ownerFilter` pattern. */
  async update(id, ownerFilter, updateData) {
    const source = await RcpSource.findOneAndUpdate(
      { _id: id, ...ownerFilter },
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );
    if (!source) throw new NotFoundError('RCP source not found or unauthorized');
    return source;
  }

  async delete(id, ownerFilter) {
    const source = await RcpSource.findOneAndDelete({ _id: id, ...ownerFilter });
    if (!source) throw new NotFoundError('RCP source not found or unauthorized');
    return source;
  }

  async deleteManyByDomain(domain) {
    return await RcpSource.deleteMany({ domain });
  }

  /** Generic filter-driven list/count pair — mirrors restApiToolSource.repository.js's `search`/`count`. */
  async search(filter, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await RcpSource.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit);
  }

  async count(filter) {
    return await RcpSource.countDocuments(filter);
  }
}

export default new RcpSourceRepository();
