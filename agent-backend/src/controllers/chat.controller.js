import assistantRepository from '../repositories/assistantRepository.js';
import conversationRepository from '../repositories/conversationRepository.js';
import messageRepository from '../repositories/messageRepository.js';
import { successFormatter } from '../utils/formatters/index.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

export const createConversation = async (req, res, next) => {
  try {
    const { assistantId } = req.params;
    const userId = req.user.id;

    // Ensure assistant exists and is accessible
    await assistantRepository.findPublicById(assistantId).catch(async () => {
      // If not public, ensure user owns it
      await assistantRepository.findByIdForOwner(assistantId, userId);
    });

    const conversation = await conversationRepository.create({
      assistantId,
      userId,
      title: req.body.title,
      lastMessageAt: null,
    });

    logger.info('Conversation created', { conversationId: conversation.id, assistantId, userId });

    res.status(201).json(
      successFormatter.formatSuccess(conversation, 'Conversation created successfully', 201)
    );
  } catch (error) {
    next(error);
  }
};

export const listConversations = async (req, res, next) => {
  try {
    const { assistantId } = req.params;
    const userId = req.user.id;
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    // Ensure assistant exists and is accessible (same logic as create)
    await assistantRepository.findPublicById(assistantId).catch(async () => {
      await assistantRepository.findByIdForOwner(assistantId, userId);
    });

    const result = await conversationRepository.listForAssistantAndUser(assistantId, userId, {
      page,
      limit,
    });

    res.json(successFormatter.formatSuccess(result));
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { assistantId, conversationId } = req.params;
    const userId = req.user.id;

    // Ensure assistant exists and is accessible
    await assistantRepository.findPublicById(assistantId).catch(async () => {
      await assistantRepository.findByIdForOwner(assistantId, userId);
    });

    // Ensure conversation belongs to this user and assistant
    const conversation = await conversationRepository.findByIdForUser(conversationId, userId);
    if (String(conversation.assistantId) !== String(assistantId)) {
      // Do not leak existence
      return res
        .status(404)
        .json(successFormatter.formatSuccess(null, 'Conversation not found', 404));
    }

    const userMessage = await messageRepository.create({
      conversationId,
      role: 'user',
      content: req.body.content,
    });

    // MVP assistant reply: simple echo acknowledging the message
    const assistantReplyText = `Thanks for your message: "${req.body.content}"`;

    const assistantMessage = await messageRepository.create({
      conversationId,
      role: 'assistant',
      content: assistantReplyText,
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    logger.info('Message exchanged', { conversationId, assistantId, userId });

    res.status(201).json(
      successFormatter.formatSuccess(
        {
          userMessage,
          assistantMessage,
        },
        'Message sent successfully',
        201
      )
    );
  } catch (error) {
    next(error);
  }
};

export const listMessages = async (req, res, next) => {
  try {
    const { assistantId, conversationId } = req.params;
    const userId = req.user.id;
    const page = req.query.page || 1;
    const limit = req.query.limit || 50;

    // Ensure assistant exists and is accessible
    await assistantRepository.findPublicById(assistantId).catch(async () => {
      await assistantRepository.findByIdForOwner(assistantId, userId);
    });

    // Ensure conversation belongs to this user and assistant
    const conversation = await conversationRepository.findByIdForUser(conversationId, userId);
    if (String(conversation.assistantId) !== String(assistantId)) {
      return res
        .status(404)
        .json(successFormatter.formatSuccess(null, 'Conversation not found', 404));
    }

    const result = await messageRepository.listByConversation(conversationId, { page, limit });

    res.json(successFormatter.formatSuccess(result));
  } catch (error) {
    next(error);
  }
};

export default {
  createConversation,
  listConversations,
  sendMessage,
  listMessages,
};
