import AuditLog from './auditLog.model.js';

/**
 * Developer Platform (Feature 6, audit log read endpoint). Read-only —
 * `auditLog.service.js`'s `record()` remains the only write path.
 */
class AuditLogRepository {
  async search(filter, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit);
  }

  async count(filter) {
    return await AuditLog.countDocuments(filter);
  }
}

export default new AuditLogRepository();
