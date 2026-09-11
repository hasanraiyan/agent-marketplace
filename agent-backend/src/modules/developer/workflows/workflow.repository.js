import Workflow from './workflow.model.js';
import { loggerService } from '../../../utils/index.js';

const logger = loggerService.getLogger();

class WorkflowRepository {
  async create(data) {
    const workflow = new Workflow(data);
    const saved = await workflow.save();
    logger.debug('[WorkflowRepository] created', { workflowId: saved._id, projectId: saved.projectId });
    return saved;
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
    const updated = await Workflow.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    logger.debug('[WorkflowRepository] updated', { workflowId: id });
    return updated;
  }

  async updateDraft(id, draft) {
    const updated = await Workflow.findByIdAndUpdate(
      id,
      { $set: { draft } },
      { new: true, runValidators: true }
    );
    logger.debug('[WorkflowRepository] draft updated', { workflowId: id });
    return updated;
  }

  async incrementPublishedVersion(id) {
    const updated = await Workflow.findByIdAndUpdate(
      id,
      { $inc: { publishedVersion: 1 } },
      { new: true }
    );
    logger.debug('[WorkflowRepository] published version incremented', { workflowId: id, publishedVersion: updated?.publishedVersion });
    return updated;
  }

  async delete(id) {
    const deleted = await Workflow.findByIdAndDelete(id);
    logger.debug('[WorkflowRepository] deleted', { workflowId: id });
    return deleted;
  }

  async deleteByProjectAndId(projectId, id) {
    const deleted = await Workflow.findOneAndDelete({ _id: id, projectId });
    logger.debug('[WorkflowRepository] deleted by project+id', { projectId, workflowId: id, found: Boolean(deleted) });
    return deleted;
  }

  /**
   * Atomic check-and-increment concurrency gate using range filter
   * (Gap 4 in research.md: index-friendly range filter, no $expr needed)
   */
  async checkAndIncrementActiveRuns(workflowId, maxConcurrent = 5) {
    const updated = await Workflow.findOneAndUpdate(
      { _id: workflowId, activeRuns: { $lt: maxConcurrent } },
      { $inc: { activeRuns: 1 } },
      { new: true }
    );
    if (!updated) {
      logger.warn('[WorkflowRepository] concurrency slot reservation failed (limit reached)', { workflowId, maxConcurrent });
    } else {
      logger.debug('[WorkflowRepository] concurrency slot reserved', { workflowId, activeRuns: updated.activeRuns });
    }
    return updated;
  }

  /**
   * Decrements active runs counter safely (floored at 0)
   */
  async decrementActiveRuns(workflowId) {
    const updated = await Workflow.findOneAndUpdate(
      { _id: workflowId, activeRuns: { $gt: 0 } },
      { $inc: { activeRuns: -1 } },
      { new: true }
    );
    logger.debug('[WorkflowRepository] concurrency slot released', { workflowId, activeRuns: updated?.activeRuns });
    return updated;
  }
}

export default new WorkflowRepository();
