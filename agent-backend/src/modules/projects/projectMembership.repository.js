import ProjectMembership from './projectMembership.model.js';

class ProjectMembershipRepository {
  async create(membershipData) {
    const membership = new ProjectMembership(membershipData);
    return await membership.save();
  }

  async findByProjectAndUser(projectId, personaUserId) {
    return await ProjectMembership.findOne({ project: projectId, personaUserId });
  }

  async findByProject(projectId) {
    return await ProjectMembership.find({ project: projectId }).sort({ createdAt: 1 });
  }

  async findByUser(personaUserId) {
    return await ProjectMembership.find({ personaUserId }).sort({ createdAt: 1 });
  }

  async countAdminsByProject(projectId) {
    return await ProjectMembership.countDocuments({ project: projectId, role: 'Admin' });
  }

  async delete(projectId, personaUserId) {
    return await ProjectMembership.findOneAndDelete({ project: projectId, personaUserId });
  }

  async deleteAllByProject(projectId) {
    return await ProjectMembership.deleteMany({ project: projectId });
  }

  async deleteAllByUser(personaUserId) {
    return await ProjectMembership.deleteMany({ personaUserId });
  }
}

export default new ProjectMembershipRepository();
