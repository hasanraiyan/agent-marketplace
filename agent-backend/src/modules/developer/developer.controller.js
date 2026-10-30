import externalUserService from '../externalUsers/externalUser.service.js';

class DeveloperController {
  /**
   * GET /api/v1/developer/whoami — returns the resolved Project principal
   * context for the presented credential, with no side effects. Lets a
   * Project backend sanity-check its own credential (and, if asserting an
   * external user, that the (Domain, Subject) it expects is what the
   * platform actually resolved) without needing a full agent-execution
   * call. Never includes anything beyond what developerMachineAuth
   * middleware itself already put on `req.projectContext` — no secret,
   * raw header, or internal Mongo _id is ever exposed here.
   */
  async whoami(req, res) {
    res.json({ success: true, data: req.projectContext });
  }

  /**
   * POST /api/v1/developer/users/sync — upserts an external user's profile metadata
   * (phoneNumber, displayName, email, avatarUrl) anchored under the authenticated Project.
   */
  async syncUser(req, res, next) {
    try {
      const context = req.projectContext;
      const domain = context.domain;
      const externalUserId =
        req.headers['x-persona-external-user-id'] ||
        req.body?.externalUserId ||
        context.externalUserId;

      if (!externalUserId) {
        return res.status(400).json({
          success: false,
          message:
            'An external user id is required (x-persona-external-user-id or externalUserId in body)',
        });
      }

      const { phoneNumber, displayName, email, avatarUrl } = req.body || {};
      const metadata = {};
      if (phoneNumber !== undefined) metadata.phoneNumber = phoneNumber;
      if (displayName !== undefined) metadata.displayName = displayName;
      if (email !== undefined) metadata.email = email;
      if (avatarUrl !== undefined) metadata.avatarUrl = avatarUrl;

      const user = await externalUserService.resolveOrCreate(domain, externalUserId, metadata);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
}

export default new DeveloperController();
