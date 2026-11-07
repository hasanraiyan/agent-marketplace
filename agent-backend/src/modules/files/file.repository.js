import DeveloperFile from './file.model.js';

class FileRepository {
  async create(data) {
    const file = new DeveloperFile(data);
    return await file.save();
  }

  async findById(id) {
    return await DeveloperFile.findById(id);
  }

  async findBySubject(subjectFilter, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await DeveloperFile.find(subjectFilter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  }

  async countBySubject(subjectFilter) {
    return await DeveloperFile.countDocuments(subjectFilter);
  }

  async deleteById(id) {
    return await DeveloperFile.findByIdAndDelete(id);
  }

  /** Adds `threadKey` to each file's threadKeys (chat attachments). */
  async bindToThread(ids, threadKey) {
    return await DeveloperFile.updateMany(
      { _id: { $in: ids } },
      { $addToSet: { threadKeys: threadKey } }
    );
  }

  /** Attachments referenced in a LangGraph thread, oldest first. */
  async findByThreadKey(threadKey) {
    return await DeveloperFile.find({ threadKeys: threadKey }).sort({ createdAt: 1, _id: 1 });
  }

  /**
   * Developer Platform (blueprint Phase 10, PR-53, AD-08 §29): unpaginated
   * — every DeveloperFile in a Domain, for the Project deletion cascade
   * (which needs every `storageKey` to unlink from disk, not a page).
   */
  async findByDomain(domain) {
    return await DeveloperFile.find({ domain });
  }

  async deleteMany(filter) {
    return await DeveloperFile.deleteMany(filter);
  }
}

export default new FileRepository();
