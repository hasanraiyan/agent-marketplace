import Message from '../models/Message.js';

class MessageRepository {
  async create(data) {
    const message = new Message(data);
    return message.save();
  }

  async listByConversation(conversationId, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId }).skip(skip).limit(limit).sort({ createdAt: 1 }),
      Message.countDocuments({ conversationId }),
    ]);

    return {
      messages,
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

const messageRepository = new MessageRepository();
export default messageRepository;
