import WorkflowVersion from './workflowVersion.model.js';

class WorkflowVersionRepository {
  async create(data) {
    const version = new WorkflowVersion(data);
    return await version.save();
  }

  async findByWorkflowAndVersion(workflowId, version) {
    return await WorkflowVersion.findOne({ workflowId, version });
  }

  async getLatestVersion(workflowId) {
    return await WorkflowVersion.findOne({ workflowId }).sort({ version: -1 });
  }

  async listByWorkflow(workflowId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await WorkflowVersion.find({ workflowId })
      .sort({ version: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countByWorkflow(workflowId) {
    return await WorkflowVersion.countDocuments({ workflowId });
  }
}

export default new WorkflowVersionRepository();
