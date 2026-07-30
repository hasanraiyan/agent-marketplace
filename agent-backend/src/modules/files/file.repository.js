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
}

export default new FileRepository();
