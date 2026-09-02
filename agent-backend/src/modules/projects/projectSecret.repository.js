import ProjectSecret from './projectSecret.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';

class ProjectSecretRepository {
  async create(secretData) {
    const secret = new ProjectSecret(secretData);
    return await secret.save();
  }

  async findById(id) {
    return await ProjectSecret.findById(id);
  }

  async findByProjectAndId(projectId, id) {
    return await ProjectSecret.findOne({ _id: id, project: projectId });
  }

  async findByProject(projectId) {
    return await ProjectSecret.find({ project: projectId }).sort({ createdAt: 1 });
  }

  async update(id, projectId, updateData) {
    const secret = await ProjectSecret.findOneAndUpdate(
      { _id: id, project: projectId },
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );
    if (!secret) throw new NotFoundError('Project secret not found', 'ProjectSecret');
    return secret;
  }

  async delete(id, projectId) {
    const secret = await ProjectSecret.findOneAndDelete({ _id: id, project: projectId });
    if (!secret) throw new NotFoundError('Project secret not found', 'ProjectSecret');
    return secret;
  }

  async touchLastUsedAt(id, when = new Date()) {
    return await ProjectSecret.findByIdAndUpdate(id, { $set: { lastUsedAt: when } });
  }

  async deleteAllByProject(projectId) {
    return await ProjectSecret.deleteMany({ project: projectId });
  }
}

export default new ProjectSecretRepository();
