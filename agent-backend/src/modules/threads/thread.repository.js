import Conversation from './thread.model.js';
import Agent from '../agents/agent.model.js';

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
    const savedThread = await thread.save();
    if (data.agentId) {
      await Agent.findByIdAndUpdate(data.agentId, { $inc: { messageCount: 1 } });
    }
    return savedThread;
  }

  async findById(id) {
    // Allows searching by either Mongoose _id or the custom threadId string
    const query = idLooksLikeObjectId(id) ? { _id: id } : { threadId: id };
    return await Conversation.findOne(query).populate('agentId', 'name avatar slug');
  }

  /**
   * Developer Platform (blueprint Phase 9, PR-39): `subjectFilter` replaces
   * the previous bare `userId` — build it with
   * `thread.service.js`'s `subjectFilterForContext(context)`. For a Persona
   * caller this is exactly `{ userId }`, byte-for-byte the same filter this
   * method built inline before.
   */
  async findBySubject(subjectFilter, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await Conversation.find({ ...subjectFilter, isArchived: false })
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
    const deletedThread = await Conversation.findOneAndDelete(query);
    if (deletedThread && deletedThread.agentId) {
      await Agent.findByIdAndUpdate(deletedThread.agentId, { $inc: { messageCount: -1 } });
    }
    return deletedThread;
  }

  /** See `findBySubject`'s doc comment — identical `subjectFilter` generalization. */
  async deleteAllBySubject(subjectFilter) {
    // We need to find all threadIds first so we can cleanup checkpoints later
    const threads = await Conversation.find({ ...subjectFilter }).select('threadId agentId');
    const threadIds = threads.map((t) => t.threadId);

    const agentCounts = {};
    for (const t of threads) {
      if (t.agentId) {
        agentCounts[t.agentId] = (agentCounts[t.agentId] || 0) + 1;
      }
    }

    const result = await Conversation.deleteMany({ ...subjectFilter });

    for (const [agentId, count] of Object.entries(agentCounts)) {
      await Agent.findByIdAndUpdate(agentId, { $inc: { messageCount: -count } });
    }

    return { ...result, threadIds };
  }

  async countByUser(userId) {
    return await Conversation.countDocuments({ userId, isArchived: false });
  }

  /** See `findBySubject`'s doc comment — identical `subjectFilter` generalization. */
  async countBySubject(subjectFilter) {
    return await Conversation.countDocuments({ ...subjectFilter, isArchived: false });
  }
}

export default new ThreadRepository();
