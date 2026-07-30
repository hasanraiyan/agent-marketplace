import McpUserConnection from './mcp-user-connection.model.js';

class McpUserConnectionRepository {
  /**
   * Developer Platform (blueprint Phase 9, PR-47c): `subjectFilter`
   * replaces the previous bare `userId` — build it with
   * `mcp.service.js`'s local `connectionSubjectFilter(context)`, or pass
   * `{ userId }` directly for the out-of-scope Persona-only runtime call
   * site (`mcp-token.service.js`). For a Persona caller this is exactly
   * `{ userId }`, byte-for-byte the same filter this method built inline
   * before — deliberately NOT including `subjectType` in the filter itself
   * (mirrors `resourceOwnership.js`/`thread.service.js`'s identical
   * choice), so pre-existing connection documents that predate the
   * `subjectType` field still match correctly.
   */
  async findByMcpAndUser(mcpId, subjectFilter) {
    return await McpUserConnection.findOne({ mcpId, ...subjectFilter });
  }

  async upsert(mcpId, subjectFilter, data) {
    return await McpUserConnection.findOneAndUpdate(
      { mcpId, ...subjectFilter },
      { $set: { mcpId, ...subjectFilter, ...data } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }

  async deleteByMcpAndUser(mcpId, subjectFilter) {
    return await McpUserConnection.findOneAndDelete({ mcpId, ...subjectFilter });
  }

  async deleteByMcp(mcpId) {
    return await McpUserConnection.deleteMany({ mcpId });
  }

  async deleteManyByUser(userId) {
    return await McpUserConnection.deleteMany({ userId });
  }
}

export default new McpUserConnectionRepository();
