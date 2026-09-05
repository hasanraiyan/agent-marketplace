import RestApiToolSource from './restApiToolSource.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';

class RestApiToolSourceRepository {
  async create(data) {
    const source = new RestApiToolSource(data);
    return await source.save();
  }

  async findById(id) {
    return await RestApiToolSource.findById(id);
  }

  /** See mcp.repository.js's `update`'s doc comment — identical `ownerFilter` pattern. */
  async update(id, ownerFilter, updateData) {
    const source = await RestApiToolSource.findOneAndUpdate(
      { _id: id, ...ownerFilter },
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );
    if (!source) throw new NotFoundError('REST API tool source not found or unauthorized');
    return source;
  }

  async delete(id, ownerFilter) {
    const source = await RestApiToolSource.findOneAndDelete({ _id: id, ...ownerFilter });
    if (!source) throw new NotFoundError('REST API tool source not found or unauthorized');
    return source;
  }

  async deleteManyByDomain(domain) {
    return await RestApiToolSource.deleteMany({ domain });
  }

  /** Generic filter-driven list/count pair — mirrors mcp.repository.js's `search`/`count`. */
  async search(filter, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await RestApiToolSource.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit);
  }

  async count(filter) {
    return await RestApiToolSource.countDocuments(filter);
  }
}

export default new RestApiToolSourceRepository();
