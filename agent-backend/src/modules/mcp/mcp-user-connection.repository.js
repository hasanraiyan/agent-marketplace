import McpUserConnection from './mcp-user-connection.model.js';

/**
 * Developer Platform (blueprint Phase 9, PR-47c/PR-48): shared by
 * `mcp.service.js` (OAuth connect/disconnect flows) and
 * `mcp-token.service.js` (runtime token resolution, `mcp-token.service.js`
 * can't import `mcp.service.js` — see that file's own doc comment on why,
 * an import cycle back through `agentFactory.js`). Kept here, a true leaf
 * module both already depend on, rather than duplicated in each. For a
 * Persona caller this is exactly `{ userId }`, byte-for-byte the same
 * filter this repository built inline before Subject-splitting —
 * deliberately NOT including `subjectType` in the filter itself (mirrors
 * `resourceOwnership.js`/`thread.service.js`'s identical choice), so
 * pre-existing connection documents that predate the `subjectType` field
 * still match correctly.
 */
export function subjectFilterForContext(context) {
  if (context?.principalType === 'ProjectRuntime') {
    return { domain: context.domain, externalUserId: context.externalUserId };
  }
  return { userId: context?.personaUserId };
}

class McpUserConnectionRepository {
  /**
   * `subjectFilter` — build it with `subjectFilterForContext(context)`
   * above, or pass `{ userId }` directly for a known-Persona caller.
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

  /**
   * Developer Platform (blueprint Phase 10, PR-53, AD-08 §29): Domain-scoped
   * bulk delete for a Project's async deletion cascade — every
   * ExternalUser-subject connection tied to this Domain (PersonaUser-subject
   * rows have no `domain`, so this never touches those).
   */
  async deleteManyByDomain(domain) {
    return await McpUserConnection.deleteMany({ domain });
  }
}

export default new McpUserConnectionRepository();
