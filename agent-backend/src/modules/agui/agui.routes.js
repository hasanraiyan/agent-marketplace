import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../../middlewares/rateLimiter.middleware.js';
import threadRepository from '../threads/thread.repository.js';
import aguiController from './agui.controller.js';

const aguiRouter = express.Router();

// Middleware: authenticate and resolve AG-UI context (userId, agentId, thread)
aguiRouter.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  try {
    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err) => (err ? reject(err) : resolve()));
    });

    const userId = req.user._id;
    const agentId = req.headers['x-agent-id'] || req.query.agentId;
    const threadDbId = req.headers['x-thread-id'] || req.query.threadId;

    let langGraphThreadId = agentId ? `agui-${agentId}-${userId}` : null;
    if (agentId && threadDbId) {
      try {
        const thread = await threadRepository.findById(threadDbId);
        if (thread && thread.userId.toString() === userId.toString()) {
          langGraphThreadId = thread.threadId;
          await threadRepository.touchLastMessageAt(thread._id);
        }
      } catch {
        // Fall back to deterministic thread id.
      }
    }

    req.aguiContext = { userId, agentId, langGraphThreadId, threadDbId };
    next();
  } catch (err) {
    next(err);
  }
});

// GET / — AGUI protocol info
aguiRouter.get('/', aguiController.getProtocolInfo);

// POST / — SSE agent run (with rate limiting)
aguiRouter.post('/', rateLimiter('CHAT', RATE_LIMITS.CHAT), aguiController.runAgent);

export default aguiRouter;
