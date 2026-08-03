import mcpService from '../mcp/mcp.service.js';
import { bulkDelete } from '../../utils/bulkDelete.js';
import { paginationEnvelope } from '../../utils/pagination.js';

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
 * `discover` (blueprint Phase 9, PR-46) serves listing — a genuinely
 * separate code path per AD-07 §19, mirroring the Agent/Skill/Knowledge
 * Developer discover methods (PR-43/44/45). See
 * `mcpService.discoverMcps`'s doc comment for why Mcp's two non-`mine`
 * modes collapse into one (no `isPublic`/`visibility` field exists).
 *
 * OAuth/runtime endpoints (blueprint Phase 9, PR-47c) round out the
 * Developer MCP surface. **No separate Developer callback routes exist**
 * — the OAuth redirect URI is a single, pre-registered URL
 * (`redirectUriFor`, unconditionally `/api/v1/mcps/oauth/{mode}/callback`)
 * that an external OAuth provider is configured against once; since
 * `mcpService.handleOwnerCallback`/`handleUserCallback` now reconstruct
 * the initiating context entirely from the verified signed state
 * (AD-02 §16, AD-07 §25), the existing Persona callback routes already
 * correctly complete BOTH Persona- and Developer-initiated flows. Per-user
 * OAuth connections for an ExternalUser Subject against an
 * `authMode: 'user'` MCP are accepted at initiation, but `readResource`/
 * `callTool`/`testConnection` will surface a clear error for that specific
 * combination until the runtime tool-execution path itself is
 * generalized (`agent.factory.js`'s `resolveMcpTools`, a separately
 * tracked Phase 7 gap) — see `mcpService._resolveAuthHeaders`'s doc
 * comment.
 */
class DeveloperMcpController {
  async testConnection(req, res, next) {
    try {
      const tools = await mcpService.testConnection(
        req.params.mcpId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: tools });
    } catch (error) {
      if (error.message === 'MCP server not found') {
        return res.status(404).json({ success: false, message: 'MCP server not found' });
      }
      next(error);
    }
  }

  async readResource(req, res, next) {
    try {
      const { uri } = req.query;
      if (!uri) {
        return res.status(400).json({ success: false, message: 'Resource URI is required' });
      }
      const content = await mcpService.readResource(
        req.params.mcpId,
        undefined,
        uri,
        req.projectContext
      );
      res.json({ success: true, data: content });
    } catch (error) {
      if (error.message === 'MCP server not found') {
        return res.status(404).json({ success: false, message: 'MCP server not found' });
      }
      next(error);
    }
  }

  async callTool(req, res, next) {
    try {
      const { name, arguments: toolArgs } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Tool name is required' });
      }
      const result = await mcpService.callTool(
        req.params.mcpId,
        undefined,
        name,
        toolArgs,
        req.projectContext
      );
      res.json({ success: true, data: result });
    } catch (error) {
      if (error.message === 'MCP server not found') {
        return res.status(404).json({ success: false, message: 'MCP server not found' });
      }
      next(error);
    }
  }

  async getOwnerAuthorizeUrl(req, res, next) {
    try {
      const url = await mcpService.getOwnerAuthorizationUrl(
        req.params.mcpId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: { url } });
    } catch (error) {
      if (error.message === 'MCP server not found') {
        return res.status(404).json({ success: false, message: 'MCP server not found' });
      }
      next(error);
    }
  }

  async getUserAuthorizeUrl(req, res, next) {
    try {
      if (req.projectContext?.principalType !== 'ProjectRuntime') {
        return res.status(400).json({
          success: false,
          message:
            'Per-user MCP authorization requires an asserted external user (x-persona-external-user-id)',
        });
      }
      const url = await mcpService.getUserAuthorizationUrl(
        req.params.mcpId,
        undefined,
        req.query.returnTo,
        req.projectContext
      );
      res.json({ success: true, data: { url } });
    } catch (error) {
      if (error.message === 'MCP server not found') {
        return res.status(404).json({ success: false, message: 'MCP server not found' });
      }
      next(error);
    }
  }

  async getUserConnectionStatus(req, res, next) {
    try {
      const status = await mcpService.getUserConnectionStatus(
        req.params.mcpId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  async disconnectUserConnection(req, res, next) {
    try {
      await mcpService.disconnectUserConnection(req.params.mcpId, undefined, req.projectContext);
      res.json({ success: true, message: 'Disconnected' });
    } catch (error) {
      next(error);
    }
  }

  async disconnectOwnerConnection(req, res, next) {
    try {
      await mcpService.disconnectOwnerConnection(req.params.mcpId, undefined, req.projectContext);
      res.json({ success: true, message: 'Owner connection disconnected' });
    } catch (error) {
      if (error.message === 'MCP server not found') {
        return res.status(404).json({ success: false, message: 'MCP server not found' });
      }
      next(error);
    }
  }

  async discover(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search, scope: req.query.scope };

      const [mcps, total] = await Promise.all([
        mcpService.discoverMcps(req.projectContext, filters, { page, limit }),
        mcpService.countDiscoverMcps(req.projectContext, filters),
      ]);
      const safeMcps = mcps.map((mcp) => mcpService.toSafeJson(mcp));

      res.json({ success: true, data: paginationEnvelope(safeMcps, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }

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

  async getUsage(req, res, next) {
    try {
      const usage = await mcpService.getMcpUsage(req.params.mcpId, undefined, req.projectContext);
      res.json({ success: true, data: usage });
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

  async bulkDelete(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        mcpService.deleteMcp(id, undefined, req.projectContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperMcpController();
