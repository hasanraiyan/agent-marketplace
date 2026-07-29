import ProjectCredential from './projectCredential.model.js';

class ProjectCredentialRepository {
  async create(credentialData) {
    const credential = new ProjectCredential(credentialData);
    return await credential.save();
  }

  async findById(id) {
    return await ProjectCredential.findById(id);
  }

  async findByKeyId(keyId) {
    return await ProjectCredential.findOne({ keyId });
  }

  async findByProjectAndId(projectId, id) {
    return await ProjectCredential.findOne({ _id: id, project: projectId });
  }

  async findByProject(projectId) {
    return await ProjectCredential.find({ project: projectId }).sort({ createdAt: 1 });
  }

  async touchLastUsedAt(id, when = new Date()) {
    return await ProjectCredential.findByIdAndUpdate(id, { $set: { lastUsedAt: when } });
  }

  async revoke(id, when = new Date()) {
    return await ProjectCredential.findOneAndUpdate(
      { _id: id, status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: when } },
      { new: true }
    );
  }

  async deleteAllByProject(projectId) {
    return await ProjectCredential.deleteMany({ project: projectId });
  }
}

export default new ProjectCredentialRepository();
