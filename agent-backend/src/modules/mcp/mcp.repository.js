import Mcp from './mcp.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';

class McpRepository {
  async create(mcpData) {
    const mcp = new Mcp(mcpData);
    return await mcp.save();
  }

  async findById(id) {
    return await Mcp.findById(id);
  }

  async findByOwner(userId) {
    return await Mcp.find({ ownerId: userId }).sort({ createdAt: -1 });
  }

  async update(id, userId, updateData) {
    const mcp = await Mcp.findOneAndUpdate(
      { _id: id, ownerId: userId },
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );

    if (!mcp) throw new NotFoundError('MCP server not found or unauthorized');
    return mcp;
  }

  async delete(id, userId) {
    const mcp = await Mcp.findOneAndDelete({ _id: id, ownerId: userId });
    if (!mcp) throw new NotFoundError('MCP server not found or unauthorized');
    return mcp;
  }

  async deleteManyByOwner(ownerId) {
    return await Mcp.deleteMany({ ownerId });
  }
}

export default new McpRepository();
