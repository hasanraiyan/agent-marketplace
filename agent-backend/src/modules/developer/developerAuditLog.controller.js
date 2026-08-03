import auditLogService from '../audit/auditLog.service.js';
import { paginationEnvelope } from '../../utils/pagination.js';

/**
 * Developer Platform audit log read endpoint (Feature 6). Control-plane
 * only, mirroring `developerProvider.controller.js`'s own precedent
 * exactly: a `ProjectRuntimeContext` request gets a silent empty result,
 * not an error — there is no per-ExternalUser audit trail concept.
 *
 * Read-only over whatever `auditLogService.record()` already writes — no
 * changes to that write path or any resource service. See
 * `auditLog.model.js`'s own docstring: today's log covers Project-lifecycle
 * events (credential minted/revoked, membership changes, suspend/restore),
 * NOT resource CRUD.
 */
class DeveloperAuditLogController {
  async list(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      if (req.projectContext?.principalType === 'ProjectRuntime') {
        return res.json({ success: true, data: paginationEnvelope([], 0, page, limit) });
      }

      const filters = { eventType: req.query.eventType };
      const [logs, total] = await Promise.all([
        auditLogService.listForDomain(req.projectContext.domain, filters, { page, limit }),
        auditLogService.countForDomain(req.projectContext.domain, filters),
      ]);

      res.json({ success: true, data: paginationEnvelope(logs, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperAuditLogController();
