import crypto from 'crypto';
import threadRepository from '../repositories/threadRepository.js';
import messageRepository from '../repositories/messageRepository.js';
import agentRepository from '../repositories/agentRepository.js';
import chatService from '../services/chat.service.js';
import { createThreadSchema, updateThreadTitleSchema, streamMessageSchema } from '../validators/thread.validator.js';

class ThreadController {
  async create(req, res, next) {
    try {
      const { agentId } = createThreadSchema.parse(req.body);
      const userId = req.user.id;

      // Ensure agent exists
      const agent = await agentRepository.findById(agentId);
      if (!agent) {
        return res.status(404).json({ success: false, message: 'Agent not found' });
      }

      // We explicitly generate a user friendly unique token for thread sharing potentially later
      const threadId = crypto.randomUUID();

      const thread = await threadRepository.create({
        agentId,
        userId,
        threadId,
      });

      res.status(201).json({ success: true, data: thread });
    } catch (error) {
      next(error);
    }
  }

  async getAllByUser(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const threads = await threadRepository.findByUser(req.user.id, { page, limit });
      
      res.json({ success: true, data: threads });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const thread = await threadRepository.findById(req.params.id);
      
      if (!thread || thread.userId.toString() !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }

      res.json({ success: true, data: thread });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const thread = await threadRepository.findById(req.params.id);
      
      if (!thread || thread.userId.toString() !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }

      // Cascade delete messages
      await messageRepository.deleteByConversation(thread._id);
      await threadRepository.delete(req.params.id);

      res.json({ success: true, message: 'Thread completely deleted' });
    } catch (error) {
      next(error);
    }
  }

  async updateTitle(req, res, next) {
    try {
      const { title } = updateThreadTitleSchema.parse(req.body);

      const thread = await threadRepository.findById(req.params.id);
      if (!thread || thread.userId.toString() !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }

      const updated = await threadRepository.update(req.params.id, { title });
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req, res, next) {
    try {
      const thread = await threadRepository.findById(req.params.id);
      
      if (!thread || thread.userId.toString() !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      const messages = await messageRepository.findByConversation(thread._id, { page, limit });

      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }

  async stream(req, res, next) {
    try {
      // Validate the incoming JSON via schema
      const { message } = streamMessageSchema.parse(req.body);

      // Trigger the server-sent events service
      // We pass `res` because the service takes full control over the connection socket
      await chatService.streamChat(res, req.params.id, req.user.id, message);
    } catch (error) {
      // If validation fails before streaming starts, respond normally.
      // If error happens during stream, `streamChat` catches and sends the SSE `data: {"error"}` pattern!
      next(error); 
    }
  }
}

export default new ThreadController();
