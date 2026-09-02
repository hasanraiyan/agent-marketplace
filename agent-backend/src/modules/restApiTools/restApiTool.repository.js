import RestApiTool from './restApiTool.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';

class RestApiToolRepository {
  async create(toolData) {
    const tool = new RestApiTool(toolData);
    return await tool.save();
  }

  async findById(id) {
    return await RestApiTool.findById(id);
  }

  async findByOwner(userId) {
    return await RestApiTool.find({ ownerId: userId }).sort({ createdAt: -1 });
  }

  /** See mcp.repository.js's `update`'s doc comment — identical `ownerFilter` pattern. */
  async update(id, ownerFilter, updateData) {
    const tool = await RestApiTool.findOneAndUpdate(
      { _id: id, ...ownerFilter },
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );
    if (!tool) throw new NotFoundError('REST API tool not found or unauthorized');
    return tool;
  }

  async delete(id, ownerFilter) {
    const tool = await RestApiTool.findOneAndDelete({ _id: id, ...ownerFilter });
    if (!tool) throw new NotFoundError('REST API tool not found or unauthorized');
    return tool;
  }

  async deleteManyByOwner(ownerId) {
    return await RestApiTool.deleteMany({ ownerId });
  }

  async deleteManyByDomain(domain) {
    return await RestApiTool.deleteMany({ domain });
  }

  /** Generic filter-driven list/count pair — mirrors mcp.repository.js's `search`/`count`. */
  async search(filter, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await RestApiTool.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit);
  }

  async count(filter) {
    return await RestApiTool.countDocuments(filter);
  }

  /** Used by projectSecret.service.js's pre-delete usage check. */
  async countUsingSecret(secretId) {
    return await RestApiTool.countDocuments({ secretRef: secretId });
  }

  async findUsingSecret(secretId, projection, limit) {
    return await RestApiTool.find({ secretRef: secretId }).select(projection).limit(limit);
  }
}

export default new RestApiToolRepository();
