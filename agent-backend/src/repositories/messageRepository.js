import Message from '../models/Message.js';

class MessageRepository {
  async addMessage(conversationId, role, content) {
    const message = new Message({
      conversationId,
      role,
      content,
    });
    return await message.save();
  }

  /**
   * Add multiple messages at once (useful for saving both the user input and the LLM output)
   */
  async addMany(messagesData) {
    return await Message.insertMany(messagesData);
  }

  async findByConversation(conversationId, { page = 1, limit = 50 } = {}) {
    // Determine sorting and offset
    // Usually messages are listed oldest first to feed to context, 
    // but a frontend might want newest first if infinite scrolling up.
    // We will do chronological (oldest first) as default context requirement.
    const skip = (page - 1) * limit;
    
    return await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);
  }

  async countByConversation(conversationId) {
    return await Message.countDocuments({ conversationId });
  }

  async deleteByConversation(conversationId) {
    return await Message.deleteMany({ conversationId });
  }
}

export default new MessageRepository();
