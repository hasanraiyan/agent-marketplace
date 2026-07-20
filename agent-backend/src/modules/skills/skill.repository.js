import Skill from './skill.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';

class SkillRepository {
  async create(skillData) {
    const skill = new Skill(skillData);
    return await skill.save();
  }

  async findById(id) {
    return await Skill.findById(id);
  }

  async findByOwner(userId) {
    return await Skill.find({ ownerId: userId }).sort({ createdAt: -1 });
  }

  async findPublicSkills(query = {}, skip = 0, limit = 20) {
    const filter = { ...query, isPublic: true };

    // Support regex name search if query provides string name
    if (filter.name && typeof filter.name === 'string') {
      filter.name = { $regex: filter.name, $options: 'i' };
    }

    const skills = await Skill.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate('ownerId', 'username avatarUrl');

    const total = await Skill.countDocuments(filter);

    return {
      skills,
      pagination: {
        total,
        page: Math.floor(skip / limit) + 1,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async searchSkills(userId, { q, scope = 'mine', limit = 30 } = {}) {
    const filter = {
      ...(scope === 'mine' ? { ownerId: userId } : { isPublic: true }),
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { instructions: { $regex: q, $options: 'i' } },
      ],
    };
    return await Skill.find(filter).limit(limit).sort({ updatedAt: -1 });
  }

  async update(id, userId, updateData) {
    const skill = await Skill.findOneAndUpdate(
      { _id: id, ownerId: userId },
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );

    if (!skill) throw new NotFoundError('Skill not found or unauthorized');
    return skill;
  }

  async delete(id, userId) {
    const skill = await Skill.findOneAndDelete({ _id: id, ownerId: userId });
    if (!skill) throw new NotFoundError('Skill not found or unauthorized');
    return skill;
  }

  async deleteManyByOwner(ownerId) {
    return await Skill.deleteMany({ ownerId });
  }
}

export default new SkillRepository();
