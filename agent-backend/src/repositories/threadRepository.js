import mongoose from 'mongoose';
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

  async findByUser(userId, { page = 1, limit = 20, agentId = null } = {}) {
    const skip = (page - 1) * limit;
    const filter = { userId, isArchived: false };
    if (agentId) {
      filter.agentId = agentId;
    }

    const [threads, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('agentId', 'name avatar slug'),
      Conversation.countDocuments(filter),
    ]);

    return { threads, total };
  }

  async search(userId, { q, agentId, limit = 20 } = {}) {
    const filter = {
      userId,
      isArchived: false,
    };

    if (agentId) {
      filter.agentId = agentId;
    }

    if (q) {
      // Escape regex special characters
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escapedQ, $options: 'i' };
    }

    return await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(limit)
      .populate('agentId', 'name avatar slug');
  }

  async getAgentSummary(userId) {
    // userId should be a Mongoose ObjectId here because it comes from req.user
    const userObjectId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    return await Conversation.aggregate([
      { $match: { userId: userObjectId, isArchived: false } },
      {
        $group: {
          _id: '$agentId',
          totalThreads: { $sum: 1 },
          lastInteractionAt: { $max: '$lastMessageAt' },
        },
      },
      {
        $lookup: {
          from: 'agents',
          localField: '_id',
          foreignField: '_id',
          as: 'agentDetails',
        },
      },
      { $unwind: { path: '$agentDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          agentId: '$_id',
          totalThreads: 1,
          lastInteractionAt: 1,
          name: { $ifNull: ['$agentDetails.name', 'Agent Architect'] },
          avatar: { $ifNull: ['$agentDetails.avatar', ''] },
          slug: { $ifNull: ['$agentDetails.slug', ''] },
        },
      },
      { $sort: { lastInteractionAt: -1 } },
    ]);
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
