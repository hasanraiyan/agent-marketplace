import providerService from '../providers/provider.service.js';

/**
 * Developer Platform Provider CRUD (blueprint Phase 9, PR-38, AD-06 §21 —
 * Provider ownership is narrower than other resources, PersonaUser/Project
 * only). Same design as developerMcp.controller.js: one route set serves
 * Project-owned Providers, determined per-request by
 * `req.projectContext.principalType`. All authorization already lives in
 * `provider.service.js` (PR-37's `isResourceOwner`/`ownerFilterForContext`
 * generalization) — this controller does none of its own.
 *
 * There is no ExternalUser case here (unlike Agent/Skill/Knowledge/Mcp):
 * `developerMachineAuthMiddleware` can still attach a `ProjectRuntimeContext`
 * to a request carrying the external-user header (it has no way to know a
 * given route only supports narrower Provider ownership), but
 * `ownerFieldsForContext` would then build an `ownerType: 'ExternalUser'`
 * payload — a shape Provider's schema enum (AD-06 §21) rejects outright.
 * `create` below rejects that case explicitly with a clear 400 rather than
 * letting it surface as an opaque Mongoose validation error. `getOne`/
 * `update`/`remove` need no equivalent guard: since no Provider can ever
 * actually have `ownerType: 'ExternalUser'`, `isResourceOwner` already
 * returns `false` for a `ProjectRuntimeContext` against any real
 * Project-owned Provider, which existence-hides to the same 404 as any
 * other non-owner.
 *
 * `getProviderById` already throws a single generic Error for both
 * "doesn't exist" and "exists but not visible to this context", so no
 * existence-hiding special-case is needed — `next(error)` maps it through
 * the default error handler.
 *
 * OAuth/runtime endpoints (test connection, fetch available models) are
 * deliberately NOT included here — same scoped-follow-up treatment as
 * Mcp's testConnection/callTool (PR-35).
 */
class DeveloperProviderController {
  async create(req, res, next) {
    try {
      if (req.projectContext?.principalType === 'ProjectRuntime') {
        return res.status(400).json({
          success: false,
          message: 'Providers cannot be owned by an ExternalUser (AD-06 §21)',
        });
      }
      const provider = await providerService.createProvider(
        undefined,
        req.body,
        req.projectContext
      );
      res.status(201).json({ success: true, data: provider });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const provider = await providerService.getProviderById(
        req.params.providerId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: provider });
    } catch (error) {
      if (error.message === 'Provider not found') {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const provider = await providerService.updateProvider(
        undefined,
        req.params.providerId,
        req.body,
        req.projectContext
      );
      res.json({ success: true, data: provider });
    } catch (error) {
      if (error.message === 'Provider not found') {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      if (error.message === 'Unauthorized to update this provider') {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await providerService.deleteProvider(undefined, req.params.providerId, req.projectContext);
      res.json({ success: true, message: 'Provider deleted successfully' });
    } catch (error) {
      if (error.message === 'Provider not found') {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      if (error.message === 'Unauthorized to delete this provider') {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      next(error);
    }
  }
}

export default new DeveloperProviderController();
