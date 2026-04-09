import Conversation from '../models/Conversation.js';
import { NotFoundError } from '../utils/errors/index.js';

class ConversationRepository {
  async create(data) {
    const conversation = new Conversation(data);
    return conversation.save();
  }

  async findByIdForUser(id, userId) {
    const conversation = await Conversation.findOne({ _id: id, userId });
    if (!conversation) {
      throw new NotFoundError(`Conversation with id ${id} not found`);
    }
    return conversation;
  }

  async listForAssistantAndUser(assistantId, userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const filter = { assistantId, userId };

    const [conversations, total] = await Promise.all([
      Conversation.find(filter).skip(skip).limit(limit).sort({ updatedAt: -1 }),
      Conversation.countDocuments(filter),
    ]);

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}

const conversationRepository = new ConversationRepository();
export default conversationRepository;
