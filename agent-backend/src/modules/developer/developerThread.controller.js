import crypto from 'crypto';
import agentRepository from '../agents/agent.repository.js';
import agentService from '../agents/agent.service.js';
import checkpointService from '../threads/checkpoint.service.js';
import threadService from '../threads/thread.service.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import { bulkDelete } from '../../utils/bulkDelete.js';
import { paginationEnvelope } from '../../utils/pagination.js';

/**
 * Developer Platform Thread CRUD (blueprint Phase 9, PR-40, AD-04 §15.3).
 *
 * Unlike every other Developer CRUD controller so far, this one is scoped
 * to `ProjectRuntimeContext` only — `developerThread.routes.js` rejects any
 * other `req.projectContext.principalType` with a 400 before reaching here
 * (mirrors `developerAgui.controller.js`'s `runAgent` guard, AD-04 §15.3: a
 * Thread's Subject is a person chatting, and only an asserted external user
 * has one; a bare Project credential has no Subject to scope a
 * conversation to).
 *
 * All ownership/Subject checks already live in `thread.service.js`
 * (PR-39's `isThreadSubject`/`subjectFilterForContext` generalization) and
 * `checkpointService.getMessages` — this controller does none of its own,
 * except validating the target Agent is actually executable by this
 * context before letting a Thread be created against it (mirroring
 * `developerAgui.controller.js`'s own `canUserExecuteAgent` check, and
 * existence-hiding per AD-07 §29: an inaccessible Agent looks identical to
 * a nonexistent one).
 *
 * This is the piece that closes the "one implicit conversation per
 * external user" gap noted in `developerAgui.controller.js`'s own doc
 * comment — an external user can now have multiple named Threads with an
 * Agent. Wiring the Developer AG-UI route itself to resume against one of
 * these Threads (rather than always using its deterministic fallback id)
 * is a deliberate follow-up, not done here — that touches the live
 * execution path and deserves its own reviewed, scoped change.
 */
class DeveloperThreadController {
  async create(req, res, next) {
    try {
      const { agentId } = req.body;

      let agent;
      try {
        agent = await agentRepository.findById(agentId);
      } catch {
        agent = null;
      }
      if (!agent || !agentService.canUserExecuteAgent(agent, req.projectContext)) {
        throw new NotFoundError('Agent not found');
      }

      const threadId = crypto.randomUUID();
      const thread = await threadService.createThread(
        undefined,
        { agentId, threadId },
        req.projectContext
      );

      res.status(201).json({ success: true, data: thread });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const [threads, total] = await Promise.all([
        threadService.getThreadsForSubject(undefined, { page, limit }, req.projectContext),
        threadService.countThreadsForSubject(undefined, req.projectContext),
      ]);

      res.json({ success: true, data: paginationEnvelope(threads, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const thread = await threadService.getThreadById(
        req.params.threadId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: thread });
    } catch (error) {
      if (error.message === 'Thread not found') {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { title, isArchived } = req.body;
      const updates = {};
      if (title !== undefined) updates.title = title;
      if (isArchived !== undefined) updates.isArchived = isArchived;

      const updated = await threadService.updateThread(
        req.params.threadId,
        undefined,
        updates,
        req.projectContext
      );
      res.json({ success: true, data: updated });
    } catch (error) {
      if (error.message === 'Thread not found') {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const deletedThread = await threadService.deleteThread(
        req.params.threadId,
        undefined,
        req.projectContext
      );

      if (deletedThread && deletedThread.threadId) {
        checkpointService.cleanupThreads(deletedThread.threadId).catch(() => {});
      }

      res.json({ success: true, message: 'Thread deleted successfully' });
    } catch (error) {
      if (error.message === 'Thread not found') {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }
      next(error);
    }
  }

  async reset(req, res, next) {
    try {
      const thread = await threadService.resetThread(
        req.params.threadId,
        undefined,
        req.projectContext
      );

      if (thread && thread.threadId) {
        await checkpointService.cleanupThreads(thread.threadId);
      }

      res.json({ success: true, data: thread });
    } catch (error) {
      if (error.message === 'Thread not found') {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }
      next(error);
    }
  }

  async bulkDelete(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, async (id) => {
        const deletedThread = await threadService.deleteThread(id, undefined, req.projectContext);
        if (deletedThread && deletedThread.threadId) {
          checkpointService.cleanupThreads(deletedThread.threadId).catch(() => {});
        }
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req, res, next) {
    try {
      const messages = await checkpointService.getMessages(
        req.params.threadId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: messages });
    } catch (error) {
      if (error.message === 'Unauthorized' || error.message === 'Thread not found') {
        return res.status(404).json({ success: false, message: 'Thread not found' });
      }
      next(error);
    }
  }
}

export default new DeveloperThreadController();
