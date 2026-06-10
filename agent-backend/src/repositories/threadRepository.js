import Conversation from '../models/Conversation.js';

function idLooksLikeObjectId(id) {
  if (id == null) return false;
  try {
    const idStr = typeof id === 'string' ? id : id.toString();
    return /^[0-9a-fA-F]{24}$/.test(idStr);
  } catch (e) {
    return false;
  }
}

class ThreadRepository {
  async create(data) {
    const thread = new Conversation(data);
    return await thread.save();
  }

  async findById(id) {
    // Allows searching by either Mongoose _id or the custom threadId string
    const query = idLooksLikeObjectId(id) ? { _id: id } : { threadId: id };
    return await Conversation.findOne(query).populate('agentId', 'name avatar slug');
  }

  async findByUser(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await Conversation.find({ userId, isArchived: false })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('agentId', 'name avatar slug');
  }

  async update(id, updateData) {
    const query = idLooksLikeObjectId(id) ? { _id: id } : { threadId: id };
    return await Conversation.findOneAndUpdate(query, updateData, { new: true });
  }

  async touchLastMessageAt(id) {
    const query = idLooksLikeObjectId(id) ? { _id: id } : { threadId: id };
    return await Conversation.findOneAndUpdate(query, { lastMessageAt: new Date() }, { new: true });
  }

  async delete(id) {
    const query = idLooksLikeObjectId(id) ? { _id: id } : { threadId: id };
    return await Conversation.findOneAndDelete(query);
  }

  async deleteAllByUser(userId) {
    return await Conversation.deleteMany({ userId });
  }

  async countByUser(userId) {
    return await Conversation.countDocuments({ userId, isArchived: false });
  }
}

export default new ThreadRepository();
