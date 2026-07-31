import AuditLog from './auditLog.model.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

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
}

export default new AuditLogService();
