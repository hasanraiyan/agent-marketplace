import McpUserConnection from '../models/McpUserConnection.js';

class McpUserConnectionRepository {
  async findByMcpAndUser(mcpId, userId) {
    return await McpUserConnection.findOne({ mcpId, userId });
  }

  async upsert(mcpId, userId, tokenData) {
    return await McpUserConnection.findOneAndUpdate(
      { mcpId, userId },
      { $set: { mcpId, userId, ...tokenData } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }

  async deleteByMcpAndUser(mcpId, userId) {
    return await McpUserConnection.findOneAndDelete({ mcpId, userId });
  }

  async deleteByMcp(mcpId) {
    return await McpUserConnection.deleteMany({ mcpId });
  }
}

export default new McpUserConnectionRepository();
