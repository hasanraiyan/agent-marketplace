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
 * `testConnection`/`getModels` (blueprint Phase 9, PR-47a) round out the
 * Developer Provider runtime surface — `providerService`'s own methods
 * were generalized alongside this controller change, same treatment as
 * every other Developer runtime endpoint added this pass.
 */
class DeveloperProviderController {
  /**
   * Lists every Provider in this credential's Domain — reuses
   * `listProvidersForProject`, previously only called from Developer
   * Studio's `ProjectAdminContext` path. That method only ever reads
   * `context.domain`, which every context type carries, so calling it here
   * is safe, but it applies no ownership filtering of its own (Studio's
   * admin browsing was always meant to see everything regardless of
   * owner). A `ProjectRuntimeContext` credential is short-circuited to an
   * empty list *before* calling it: a Provider's `ownerType` can only ever
   * be `'PersonaUser'` or `'Project'`, never `'ExternalUser'` (AD-06 §21),
   * so `isResourceOwner` always rejects a `ProjectRuntimeContext` against
   * every real Provider in `getOne`/`update`/`remove`/`testConnection`/
   * `getModels` below — an unfiltered list here would show Providers this
   * exact same credential can never actually fetch individually. Matches
   * this file's own established existence-hiding philosophy (see the
   * `getOne`/`update`/`remove` comment above): silent empty result, not an
   * error, mirroring how a single 404 already replaces an explicit
   * "unauthorized".
   */
  async list(req, res, next) {
    try {
      if (req.projectContext?.principalType === 'ProjectRuntime') {
        return res.json({ success: true, data: [] });
      }
      const providers = await providerService.listProvidersForProject(req.projectContext);
      res.json({ success: true, data: providers });
    } catch (error) {
      next(error);
    }
  }

  async testConnection(req, res, next) {
    try {
      const result = await providerService.testConnection(
        req.params.providerId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: result });
    } catch (error) {
      if (
        error.message === 'Provider not found' ||
        error.message === 'Unauthorized to test this provider'
      ) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getModels(req, res, next) {
    try {
      const models = await providerService.getAvailableModels(
        req.params.providerId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: models });
    } catch (error) {
      if (
        error.message === 'Provider not found' ||
        error.message === 'Unauthorized to access this provider'
      ) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

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
