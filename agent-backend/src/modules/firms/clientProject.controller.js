import clientProjectService from './clientProject.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

class ClientProjectController {
  async start(req, res, next) {
    try {
      const result = await clientProjectService.startProject(
        req.user._id,
        req.params.slug,
        req.params.projectSlug,
        req.body?.inputs || {}
      );
      ok(res, result, 201);
    } catch (err) {
      if (err.code === 'MISSING_INPUTS') {
        return res.status(400).json({ success: false, message: err.message, details: err.details });
      }
      next(err);
    }
  }
  async listMine(req, res, next) {
    try {
      ok(res, await clientProjectService.listMine(req.user._id));
    } catch (err) {
      next(err);
    }
  }
  async listMyFirms(req, res, next) {
    try {
      ok(res, await clientProjectService.listMyFirms(req.user._id));
    } catch (err) {
      next(err);
    }
  }
  async get(req, res, next) {
    try {
      ok(res, await clientProjectService.getForUser(req.params.id, req.user._id));
    } catch (err) {
      next(err);
    }
  }
  async respond(req, res, next) {
    try {
      ok(
        res,
        await clientProjectService.respondToInbox(
          req.params.id,
          req.user._id,
          req.params.itemId,
          req.body.response
        )
      );
    } catch (err) {
      next(err);
    }
  }
  async accept(req, res, next) {
    try {
      const index = parseInt(req.params.index, 10);
      ok(res, await clientProjectService.acceptDeliverable(req.params.id, req.user._id, index));
    } catch (err) {
      next(err);
    }
  }
}

export default new ClientProjectController();
