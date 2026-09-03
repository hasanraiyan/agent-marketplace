import Firm from './firm.model.js';
import FirmProject from './firmProject.model.js';
import ClientProject from './clientProject.model.js';

class FirmRepository {
  async create(data) {
    return await new Firm(data).save();
  }
  async findById(id) {
    return await Firm.findById(id);
  }
  async findByOwner(ownerId) {
    return await Firm.findOne({ ownerId });
  }
  async findBySlug(slug) {
    return await Firm.findOne({ slug });
  }
  async slugExists(slug) {
    return Boolean(await Firm.exists({ slug }));
  }
  async update(id, updateData) {
    return await Firm.findByIdAndUpdate(id, updateData, {
      returnDocument: 'after',
      runValidators: true,
    });
  }
  async search(filter, { page = 1, limit = 30 } = {}) {
    const skip = (page - 1) * limit;
    return await Firm.find(filter).sort({ publishedAt: -1, updatedAt: -1 }).skip(skip).limit(limit);
  }
  async count(filter) {
    return await Firm.countDocuments(filter);
  }
  async findManyByIds(ids) {
    return await Firm.find({ _id: { $in: ids } });
  }
  async incrementStat(id, field, by = 1) {
    return await Firm.findByIdAndUpdate(id, { $inc: { [`stats.${field}`]: by } });
  }
}

class FirmProjectRepository {
  async create(data) {
    return await new FirmProject(data).save();
  }
  async findById(id) {
    return await FirmProject.findById(id);
  }
  async findByFirm(firmId, filter = {}) {
    return await FirmProject.find({ firmId, ...filter }).sort({ order: 1, createdAt: 1 });
  }
  async findByFirmAndSlug(firmId, slug) {
    return await FirmProject.findOne({ firmId, slug });
  }
  async slugExists(firmId, slug) {
    return Boolean(await FirmProject.exists({ firmId, slug }));
  }
  async update(id, firmId, updateData) {
    return await FirmProject.findOneAndUpdate({ _id: id, firmId }, updateData, {
      returnDocument: 'after',
      runValidators: true,
    });
  }
  async delete(id, firmId) {
    return await FirmProject.findOneAndDelete({ _id: id, firmId });
  }
  async countByFirms(firmIds, filter = {}) {
    const rows = await FirmProject.aggregate([
      { $match: { firmId: { $in: firmIds }, ...filter } },
      { $group: { _id: '$firmId', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
  }
}

class ClientProjectRepository {
  async create(data) {
    return await new ClientProject(data).save();
  }
  async findById(id) {
    return await ClientProject.findById(id);
  }
  async findByIdPopulated(id) {
    return await ClientProject.findById(id)
      .populate('firmId', 'name slug avatar tagline ownerId')
      .populate('leadAgentId', 'name avatar slug role')
      .populate('clientId', 'name email')
      .populate('templateId', 'slug title');
  }
  async findByClient(clientId) {
    return await ClientProject.find({ clientId })
      .sort({ lastActivityAt: -1 })
      .populate('firmId', 'name slug avatar tagline')
      .populate('leadAgentId', 'name avatar slug role');
  }
  async findByFirm(firmId) {
    return await ClientProject.find({ firmId })
      .sort({ lastActivityAt: -1 })
      .populate('clientId', 'name email')
      .populate('leadAgentId', 'name avatar slug role');
  }
  async save(doc) {
    return await doc.save();
  }
}

export const firmRepository = new FirmRepository();
export const firmProjectRepository = new FirmProjectRepository();
export const clientProjectRepository = new ClientProjectRepository();
