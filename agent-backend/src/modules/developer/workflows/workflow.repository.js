import Workflow from './workflow.model.js';

class WorkflowRepository {
  async create(data) {
    const workflow = new Workflow(data);
    return await workflow.save();
  }

  async findById(id) {
    return await Workflow.findById(id);
  }

  async findByProjectAndId(projectId, id) {
    return await Workflow.findOne({ _id: id, projectId });
  }

  async listByProject(projectId, { page = 1, limit = 20, search, isEnabled, visibility, externalOwnerId, customFilter } = {}) {
    const filter = { projectId, ...(customFilter || {}) };
    if (typeof isEnabled === 'boolean') {
      filter.isEnabled = isEnabled;
    }
    if (visibility) {
      filter.visibility = visibility;
    }
    if (externalOwnerId) {
      filter.externalOwnerId = externalOwnerId;
    }
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    return await Workflow.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countByProject(projectId, { search, isEnabled, visibility, externalOwnerId, customFilter } = {}) {
    const filter = { projectId, ...(customFilter || {}) };
    if (typeof isEnabled === 'boolean') {
      filter.isEnabled = isEnabled;
    }
    if (visibility) {
      filter.visibility = visibility;
    }
    if (externalOwnerId) {
      filter.externalOwnerId = externalOwnerId;
    }
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    return await Workflow.countDocuments(filter);
  }

  async update(id, updateData) {
    return await Workflow.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async updateDraft(id, draft) {
    return await Workflow.findByIdAndUpdate(
      id,
      { $set: { draft } },
      { new: true, runValidators: true }
    );
  }

  async incrementPublishedVersion(id) {
    return await Workflow.findByIdAndUpdate(
      id,
      { $inc: { publishedVersion: 1 } },
      { new: true }
    );
  }

  async delete(id) {
    return await Workflow.findByIdAndDelete(id);
  }

  async deleteByProjectAndId(projectId, id) {
    return await Workflow.findOneAndDelete({ _id: id, projectId });
  }

  /**
   * Atomic check-and-increment concurrency gate using range filter
   * (Gap 4 in research.md: index-friendly range filter, no $expr needed)
   */
  async checkAndIncrementActiveRuns(workflowId, maxConcurrent = 5) {
    return await Workflow.findOneAndUpdate(
      { _id: workflowId, activeRuns: { $lt: maxConcurrent } },
      { $inc: { activeRuns: 1 } },
      { new: true }
    );
  }

  /**
   * Decrements active runs counter safely (floored at 0)
   */
  async decrementActiveRuns(workflowId) {
    return await Workflow.findOneAndUpdate(
      { _id: workflowId, activeRuns: { $gt: 0 } },
      { $inc: { activeRuns: -1 } },
      { new: true }
    );
  }
}

export default new WorkflowRepository();
