import ExternalUser from './externalUser.model.js';

class ExternalUserRepository {
  /**
   * JIT resolve-or-create as a single atomic Mongo upsert — race-safe
   * under concurrent first-requests for the same new (project,
   * externalUserId) pair, and idempotent thereafter (AD-02 §11.1).
   * `metadata` fields are applied only if explicitly supplied — a
   * caller omitting a field never clears it.
   */
  async resolveOrCreate(project, externalUserId, metadata = {}) {
    const setFields = { lastSeenAt: new Date() };
    if (metadata.displayName !== undefined) setFields.displayName = metadata.displayName;
    if (metadata.email !== undefined) setFields.email = metadata.email;
    if (metadata.avatarUrl !== undefined) setFields.avatarUrl = metadata.avatarUrl;

    return await ExternalUser.findOneAndUpdate(
      { project, externalUserId },
      { $set: setFields, $setOnInsert: { project, externalUserId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async findByProjectAndExternalUserId(project, externalUserId) {
    return await ExternalUser.findOne({ project, externalUserId });
  }

  async findByProject(project) {
    return await ExternalUser.find({ project }).sort({ createdAt: 1 });
  }

  async deleteAllByProject(project) {
    return await ExternalUser.deleteMany({ project });
  }
}

export default new ExternalUserRepository();
