import crypto from 'crypto';
import agentRepository from '../agents/agent.repository.js';
import checkpointService from './checkpoint.service.js';
import threadService from './thread.service.js';
import { createThreadSchema, updateThreadTitleSchema } from './thread.validator.js';

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

      const thread = await threadService.createThread(userId, { agentId, threadId });

      res.status(201).json({ success: true, data: thread });
    } catch (error) {
      next(error);
    }
  }

  async getAllByUser(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const threads = await threadService.getThreadsForSubject(req.user.id, { page, limit });

      res.json({ success: true, data: threads });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const thread = await threadService.getThreadById(req.params.id, req.user.id);

      res.json({ success: true, data: thread });
    } catch (error) {
      if (error.message === 'Thread not found') {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const deletedThread = await threadService.deleteThread(req.params.id, req.user.id);

      // Cascading cleanup of LangGraph checkpoints
      if (deletedThread && deletedThread.threadId) {
        checkpointService.cleanupThreads(deletedThread.threadId).catch(() => {});
      }

      res.json({ success: true, message: 'Thread permanently removed' });
    } catch (error) {
      if (error.message === 'Thread not found') {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }
      next(error);
    }
  }

  async deleteAll(req, res, next) {
    try {
      const result = await threadService.deleteAllThreadsForSubject(req.user.id);

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

      const updated = await threadService.updateThreadTitle(req.params.id, req.user.id, title);
      res.json({ success: true, data: updated });
    } catch (error) {
      if (error.message === 'Thread not found') {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }
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
