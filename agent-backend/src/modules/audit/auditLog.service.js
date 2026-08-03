import AuditLog from './auditLog.model.js';
import auditLogRepository from './auditLog.repository.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

function _buildDomainFilter(domain, filters = {}) {
  const filter = { targetDomain: String(domain) };
  if (filters.eventType) filter.eventType = filters.eventType;
  return filter;
}

/**
 * Developer Platform (blueprint Phase 10, PR-51, AD-08 §35). `record` is
 * deliberately fire-and-forget: an audit-write failure must never block or
 * fail the lifecycle action it's recording — the action itself is what
 * matters; the audit trail is best-effort logging of it, not a
 * transactional part of it. AD-08 doesn't mandate either way; this is the
 * safer default (a lost audit row is recoverable-by-investigation, a
 * blocked Project action is not).
 */
class AuditLogService {
  async record({
    eventType,
    actorContextType,
    actorIdentity,
    targetDomain,
    targetResourceId,
    metadata,
  }) {
    try {
      await AuditLog.create({
        eventType,
        actorContextType,
        actorIdentity: actorIdentity != null ? String(actorIdentity) : null,
        targetDomain: String(targetDomain),
        targetResourceId: targetResourceId != null ? String(targetResourceId) : null,
        metadata: metadata || {},
      });
    } catch (error) {
      logger.error(
        `[AuditLog] Failed to record event "${eventType}" for domain ${targetDomain}:`,
        error
      );
    }
  }

  /**
   * Developer Platform (Feature 6) — read access to the audit trail
   * `record()` already writes. Covers Project-lifecycle events only
   * (credential minted/revoked, membership changes, suspend/restore), NOT
   * resource CRUD (Agent/Skill/Knowledge/Provider/MCP create/update/delete
   * aren't logged here yet — see this module's own docstring).
   */
  async listForDomain(domain, filters, pagination) {
    return await auditLogRepository.search(_buildDomainFilter(domain, filters), pagination);
  }

  async countForDomain(domain, filters) {
    return await auditLogRepository.count(_buildDomainFilter(domain, filters));
  }
}

export default new AuditLogService();
