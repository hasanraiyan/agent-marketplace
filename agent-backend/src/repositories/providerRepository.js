                                                                                                                                                                                                 import Provider from '../models/Provider.js';

class ProviderRepository {
  async create(providerData) {
    const provider = new Provider(providerData);
    return await provider.save();
  }

  async findById(id) {
    return await Provider.findById(id);
  }

  async findByUser(userId) {
    return await Provider.find({ ownerId: userId }).sort({ createdAt: -1 });
  }

  async update(id, updateData) {
    return await Provider.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id) {
    return await Provider.findByIdAndDelete(id);
  }

  async clearUserDefaultKeys(userId) {
    return await Provider.updateMany(
      { ownerId: userId, isDefault: true },
      { $set: { isDefault: false } }
    );
  }
}

export default new ProviderRepository();
