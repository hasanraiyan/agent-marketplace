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

  /**
   * Developer Platform (blueprint Phase 9, PR-34): `ownerFilter` replaces
   * the previous bare `userId` — build it with
   * `resourceOwnership.ownerFilterForContext(context)`, or pass
   * `{ ownerId: userId }` directly for the out-of-scope OAuth/runtime
   * callers that stay Persona-only. For a Persona caller this is
   * byte-for-byte the same filter this method built inline before. See
   * `skill.repository.js`'s identical PR-28 generalization.
   */
  async update(id, ownerFilter, updateData) {
    const mcp = await Mcp.findOneAndUpdate(
      { _id: id, ...ownerFilter },
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );

    if (!mcp) throw new NotFoundError('MCP server not found or unauthorized');
    return mcp;
  }

  /** See `update`'s doc comment — identical `ownerFilter` generalization. */
  async delete(id, ownerFilter) {
    const mcp = await Mcp.findOneAndDelete({ _id: id, ...ownerFilter });
    if (!mcp) throw new NotFoundError('MCP server not found or unauthorized');
    return mcp;
  }

  async deleteManyByOwner(ownerId) {
    return await Mcp.deleteMany({ ownerId });
  }
}

export default new McpRepository();
