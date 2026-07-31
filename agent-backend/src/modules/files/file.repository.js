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

  async deleteById(id) {
    return await DeveloperFile.findByIdAndDelete(id);
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
