import agentService from '../agents/agent.service.js';

/**
 * Developer Platform Agent CRUD (blueprint Phase 9, PR-26, AD-07 §15/16/17).
 *
 * A single route set serves both Project-owned and ExternalUser-owned
 * Agents — the same Project credential authenticates both, and which kind
 * gets created/managed is determined per-request by `req.projectContext`'s
 * `principalType` (set by `developerMachineAuthMiddleware` depending on
 * whether `x-persona-external-user-id` is present):
 *   - `ProjectMachineContext` / `ProjectAdminContext` → Project-owned
 *   - `ProjectRuntimeContext` → ExternalUser-owned (that Subject)
 *
 * `agentService.createDeveloperAgent`/`updateAgent`/`deleteAgent`/
 * `getDeveloperAgentById` already enforce the correct authorization for
 * each case via the shared `isAgentOwner`/`canUserExecuteAgent` checks —
 * this controller does no authorization logic of its own.
 *
 * List/discovery ("Project's own Agents", "my Agents", "Project-public
 * browse") is served by `discover` below — a genuinely separate code path
 * from Persona's marketplace search (`agentService.searchAgents`/
 * `_buildSearchFilter`), per AD-07 §19's explicit discovery contract. See
 * `agentService.discoverAgents`'s doc comment for the three discovery
 * modes this maps to depending on `req.projectContext`.
 */
class DeveloperAgentController {
  async discover(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = {
        search: req.query.search,
        category: req.query.category,
        scope: req.query.scope,
      };

      const agents = await agentService.discoverAgents(req.projectContext, filters, {
        page,
        limit,
      });

      res.json({ success: true, data: agents });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const agent = await agentService.createDeveloperAgent(req.projectContext, req.body);
      res.status(201).json({ success: true, data: agent });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const agent = await agentService.getDeveloperAgentById(
        req.params.agentId,
        req.projectContext
      );
      res.json({ success: true, data: agent });
    } catch (error) {
      // Existence-hiding (AD-07 §29): same 404 whether the Agent doesn't
      // exist, isn't executable in this Domain, or is private to someone
      // else — never a distinguishable error.
      if (error.message === 'Agent not found or is private') {
        return res.status(404).json({ success: false, message: 'Agent not found' });
      }
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const agent = await agentService.updateAgent(
        req.params.agentId,
        undefined,
        req.body,
        req.projectContext
      );
      res.json({ success: true, data: agent });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await agentService.deleteAgent(req.params.agentId, undefined, req.projectContext);
      res.json({ success: true, message: 'Agent deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperAgentController();
