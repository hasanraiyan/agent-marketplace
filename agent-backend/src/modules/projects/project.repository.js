import Project from './project.model.js';

class ProjectRepository {
  async create(projectData) {
    const project = new Project(projectData);
    return await project.save();
  }

  async findById(id) {
    return await Project.findById(id);
  }

  async findBySlug(slug) {
    return await Project.findOne({ slug });
  }

  async updateMetadata(id, updateData) {
    return await Project.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  }

  async updateStatus(id, status, extra = {}) {
    return await Project.findByIdAndUpdate(
      id,
      { $set: { status, ...extra } },
      { new: true, runValidators: true }
    );
  }
}

export default new ProjectRepository();
