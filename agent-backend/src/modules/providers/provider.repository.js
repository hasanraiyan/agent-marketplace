import Provider from './provider.model.js';

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

  /**
   * Developer Platform (blueprint Phase 9, PR-37): `ownerFilter` replaces
   * the previous bare `userId` — build it with
   * `resourceOwnership.ownerFilterForContext(context)`. For a Persona
   * caller this is exactly `{ ownerId: userId }`, byte-for-byte the same
   * filter this method built inline before. "Default provider" is scoped
   * per-owner regardless of owner type: a Project's own default should
   * only ever be cleared by that Project creating/promoting its own new
   * default, never by an unrelated Persona User's or another Project's
   * write.
   */
  async clearDefaultKeys(ownerFilter) {
    return await Provider.updateMany(
      { ...ownerFilter, isDefault: true },
      { $set: { isDefault: false } }
    );
  }

  async deleteManyByOwner(ownerId) {
    return await Provider.deleteMany({ ownerId });
  }
}

export default new ProviderRepository();
