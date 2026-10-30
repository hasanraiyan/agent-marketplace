import mongoose from 'mongoose';
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
    if (!mongoose.Types.ObjectId.isValid(project)) return null;
    const setFields = { lastSeenAt: new Date() };
    if (metadata.displayName !== undefined) setFields.displayName = metadata.displayName;
    if (metadata.email !== undefined) setFields.email = metadata.email;
    if (metadata.avatarUrl !== undefined) setFields.avatarUrl = metadata.avatarUrl;
    if (metadata.phoneNumber !== undefined) setFields.phoneNumber = metadata.phoneNumber;

    return await ExternalUser.findOneAndUpdate(
      { project, externalUserId },
      { $set: setFields, $setOnInsert: { project, externalUserId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }

  async findByProjectAndExternalUserId(project, externalUserId) {
    if (!mongoose.Types.ObjectId.isValid(project)) return null;
    return await ExternalUser.findOne({ project, externalUserId });
  }

  async findByProjectAndPhoneNumber(project, phoneNumber) {
    if (!phoneNumber || !mongoose.Types.ObjectId.isValid(project)) return null;
    const cleanDigits = String(phoneNumber).replace(/[^0-9]/g, '');
    return await ExternalUser.findOne({
      project,
      $or: [
        { phoneNumber },
        { phoneNumber: `+${cleanDigits}` },
        { phoneNumber: cleanDigits },
      ],
    });
  }

  async findByProject(project) {
    if (!mongoose.Types.ObjectId.isValid(project)) return [];
    return await ExternalUser.find({ project }).sort({ createdAt: 1 });
  }

  async deleteAllByProject(project) {
    return await ExternalUser.deleteMany({ project });
  }
}

export default new ExternalUserRepository();
