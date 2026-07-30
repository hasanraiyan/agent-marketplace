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
}

export default new DeveloperController();
