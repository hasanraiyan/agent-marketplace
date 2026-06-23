import mcpService from '../services/mcp.service.js';
import config from '../config/index.js';

class McpController {
  async create(req, res, next) {
    try {
      const mcp = await mcpService.createMcp(req.user.id, req.body);
      res.status(201).json({ success: true, data: mcpService.toSafeJson(mcp) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'You already have an MCP server with this exact name' });
      }
      next(error);
    }
  }

  async getMyMcps(req, res, next) {
    try {
      const mcps = await mcpService.getMyMcps(req.user.id);
      res.json({ success: true, data: mcps.map((mcp) => mcpService.toSafeJson(mcp)) });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const mcp = await mcpService.getMcpById(req.params.id, req.user.id);
      res.json({ success: true, data: mcpService.toSafeJson(mcp) });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const mcp = await mcpService.updateMcp(req.params.id, req.user.id, req.body);
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

  async delete(req, res, next) {
    try {
      await mcpService.deleteMcp(req.params.id, req.user.id);
      res.json({ success: true, message: 'MCP server successfully deleted' });
    } catch (error) {
      next(error);
    }
  }

  async getUsedByAgents(req, res, next) {
    try {
      await mcpService.getMcpById(req.params.id, req.user.id);
      const agents = await mcpService.getAgentsByMcp(req.params.id);
      res.json({ success: true, data: agents });
    } catch (error) {
      next(error);
    }
  }

  async testConnection(req, res, next) {
    try {
      const tools = await mcpService.testConnection(req.params.id, req.user.id);
      res.json({ success: true, data: tools });
    } catch (error) {
      next(error);
    }
  }

  async readResource(req, res, next) {
    try {
      const { uri } = req.query;
      if (!uri) {
        return res.status(400).json({ success: false, message: 'Resource URI is required' });
      }
      const content = await mcpService.readResource(req.params.id, req.user.id, uri);
      res.json({ success: true, data: content });
    } catch (error) {
      next(error);
    }
  }

  async callTool(req, res, next) {
    try {
      const { name, arguments: toolArgs } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Tool name is required' });
      }
      const result = await mcpService.callTool(req.params.id, req.user.id, name, toolArgs);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOwnerAuthorizeUrl(req, res, next) {
    try {
      const url = await mcpService.getOwnerAuthorizationUrl(req.params.id, req.user.id);
      res.json({ success: true, data: { url } });
    } catch (error) {
      next(error);
    }
  }

  async ownerCallback(req, res, next) {
    try {
      const { code, state } = req.query;
      const redirectTo = await mcpService.handleOwnerCallback(code, state);
      res.redirect(redirectTo);
    } catch (error) {
      res.redirect(
        `${config.websiteUrl.replace(/\/+$/, '')}/dashboard/connectors/mcps?error=oauth_failed`
      );
    }
  }

  async getUserAuthorizeUrl(req, res, next) {
    try {
      const url = await mcpService.getUserAuthorizationUrl(
        req.params.id,
        req.user.id,
        req.query.returnTo
      );
      res.json({ success: true, data: { url } });
    } catch (error) {
      next(error);
    }
  }

  async userCallback(req, res, next) {
    try {
      const { code, state } = req.query;
      const redirectTo = await mcpService.handleUserCallback(code, state);
      res.redirect(redirectTo);
    } catch (error) {
      res.redirect(`${config.websiteUrl.replace(/\/+$/, '')}?error=oauth_failed`);
    }
  }

  async getUserConnectionStatus(req, res, next) {
    try {
      const status = await mcpService.getUserConnectionStatus(req.params.id, req.user.id);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  async disconnectUserConnection(req, res, next) {
    try {
      await mcpService.disconnectUserConnection(req.params.id, req.user.id);
      res.json({ success: true, message: 'Disconnected' });
    } catch (error) {
      next(error);
    }
  }
}

export default new McpController();
