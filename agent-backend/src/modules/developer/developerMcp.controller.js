import mcpService from '../mcp/mcp.service.js';

/**
 * Developer Platform MCP CRUD (blueprint Phase 9, PR-35, AD-04 §18 — MCP
 * definitions follow the identical shape as Agent/Skill/KnowledgeBase). Same
 * design as developerSkill.controller.js: one route set serves both
 * Project-owned and ExternalUser-owned MCPs, determined per-request by
 * `req.projectContext.principalType`. All authorization already lives in
 * `mcp.service.js` (PR-34's `isResourceOwner`/`ownerFilterForContext`
 * generalization) — this controller does none of its own.
 *
 * `getMcpById` already throws a single generic NotFoundError for both
 * "doesn't exist" and "exists but not visible to this context" (unlike
 * Skill's public/private distinction), so no existence-hiding special-case
 * is needed here — `next(error)` alone gives the same 404 either way.
 *
 * OAuth/runtime endpoints (test connection, authorize URLs, callbacks,
 * tool/resource calls) are deliberately NOT included here — same scoped-
 * follow-up treatment as Knowledge's document upload/search (PR-32).
 */
class DeveloperMcpController {
  async create(req, res, next) {
    try {
      const mcp = await mcpService.createMcp(undefined, req.body, req.projectContext);
      res.status(201).json({ success: true, data: mcpService.toSafeJson(mcp) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'An MCP server with this exact name already exists' });
      }
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const mcp = await mcpService.getMcpById(req.params.mcpId, undefined, req.projectContext);
      res.json({ success: true, data: mcpService.toSafeJson(mcp) });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const mcp = await mcpService.updateMcp(
        req.params.mcpId,
        undefined,
        req.body,
        req.projectContext
      );
      res.json({ success: true, data: mcpService.toSafeJson(mcp) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another MCP server with this name already exists' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await mcpService.deleteMcp(req.params.mcpId, undefined, req.projectContext);
      res.json({ success: true, message: 'MCP server deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperMcpController();
