import firmService from './firm.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

class FirmController {
  // Public
  async list(req, res, next) {
    try {
      const { search, category } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 30, 100);
      const result = await firmService.listPublished({ search, category, page, limit });
      res.json({
        success: true,
        data: result.firms,
        pagination: { total: result.total, page: result.page, limit: result.limit },
      });
    } catch (err) {
      next(err);
    }
  }
  async storefront(req, res, next) {
    try {
      ok(res, await firmService.getStorefront(req.params.slug, req.user?._id));
    } catch (err) {
      next(err);
    }
  }
  async publicProject(req, res, next) {
    try {
      ok(res, await firmService.getPublicProject(req.params.slug, req.params.projectSlug, req.user?._id));
    } catch (err) {
      next(err);
    }
  }

  // Owner
  async me(req, res, next) {
    try {
      ok(res, await firmService.getMyFirm(req.user._id));
    } catch (err) {
      next(err);
    }
  }
  async create(req, res, next) {
    try {
      ok(res, await firmService.createFirm(req.user._id, req.body), 201);
    } catch (err) {
      next(err);
    }
  }
  async update(req, res, next) {
    try {
      ok(res, await firmService.updateMyFirm(req.user._id, req.body));
    } catch (err) {
      next(err);
    }
  }
  async publish(req, res, next) {
    try {
      ok(res, await firmService.publishMyFirm(req.user._id));
    } catch (err) {
      if (err.code === 'FIRM_NOT_READY') {
        return res.status(400).json({ success: false, message: err.message, details: err.details });
      }
      next(err);
    }
  }
  async unpublish(req, res, next) {
    try {
      ok(res, await firmService.unpublishMyFirm(req.user._id));
    } catch (err) {
      next(err);
    }
  }
  async listProjects(req, res, next) {
    try {
      ok(res, await firmService.listMyProjects(req.user._id));
    } catch (err) {
      next(err);
    }
  }
  async createProject(req, res, next) {
    try {
      ok(res, await firmService.createProject(req.user._id, req.body), 201);
    } catch (err) {
      next(err);
    }
  }
  async updateProject(req, res, next) {
    try {
      ok(res, await firmService.updateProject(req.user._id, req.params.id, req.body));
    } catch (err) {
      next(err);
    }
  }
  async deleteProject(req, res, next) {
    try {
      await firmService.deleteProject(req.user._id, req.params.id);
      res.json({ success: true, message: 'Project deleted' });
    } catch (err) {
      next(err);
    }
  }
  async listTeam(req, res, next) {
    try {
      ok(res, await firmService.listMyTeam(req.user._id));
    } catch (err) {
      next(err);
    }
  }
  async updateTeamMember(req, res, next) {
    try {
      ok(res, await firmService.updateTeamMember(req.user._id, req.params.agentId, req.body));
    } catch (err) {
      next(err);
    }
  }
  async listClients(req, res, next) {
    try {
      ok(res, await firmService.listMyClients(req.user._id));
    } catch (err) {
      next(err);
    }
  }
}

export default new FirmController();
