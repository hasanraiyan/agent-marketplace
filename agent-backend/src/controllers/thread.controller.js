import crypto from 'crypto';
import threadRepository from '../repositories/threadRepository.js';
import agentRepository from '../repositories/agentRepository.js';
import checkpointService from '../services/checkpoint.service.js';
import { createThreadSchema, updateThreadTitleSchema } from '../validators/thread.validator.js';

class ThreadController {
  async create(req, res, next) {
    try {
      const { agentId } = createThreadSchema.parse(req.body);
      const userId = req.user.id;

      // Ensure agent exists
      const agent = await agentRepository.findById(agentId);
      if (!agent && agentId !== '000000000000000000000000') {
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

      const deletedThread = await threadRepository.delete(req.params.id);

      // Cascading cleanup of LangGraph checkpoints
      if (deletedThread && deletedThread.threadId) {
        checkpointService.cleanupThreads(deletedThread.threadId).catch(() => {});
      }

      res.json({ success: true, message: 'Thread permanently removed' });
    } catch (error) {
      next(error);
    }
  }

  async deleteAll(req, res, next) {
    try {
      const result = await threadRepository.deleteAllByUser(req.user.id);

      // Cascading cleanup of LangGraph checkpoints
      if (result && result.threadIds && result.threadIds.length > 0) {
        checkpointService.cleanupThreads(result.threadIds).catch(() => {});
      }

      res.json({ success: true, message: 'All threads permanently removed' });
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
      const messages = await checkpointService.getMessages(req.params.id, req.user.id);
      res.json({ success: true, data: messages });
    } catch (error) {
      if (error.message === 'Unauthorized' || error.message === 'Thread not found') {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }
      next(error);
    }
  }
}

export default new ThreadController();
