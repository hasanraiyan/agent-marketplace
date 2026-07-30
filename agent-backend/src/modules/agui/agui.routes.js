import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
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
        // Developer Platform (blueprint §33 architecture debt, Phase 6): a
        // thread must match both the requesting user AND the agent it was
        // created with. Without the agentId check, a caller could resume a
        // thread's checkpoint history (and persist new messages onto it)
        // under a different agent's config by simply sending a different
        // x-agent-id — same fallback as the userId mismatch below: treat it
        // as no valid thread was given rather than surfacing an error.
        //
        // Bug fix (blueprint Phase 9, PR-42): `thread.agentId` comes back
        // POPULATED (thread.repository.js's findById always populates it
        // for display purposes), so `String(thread.agentId)` never equaled
        // a bare `agentId` string — it stringified to a multi-line object
        // dump instead. That meant this check ALWAYS failed silently and
        // this route ALWAYS fell back to the deterministic thread id
        // (`agui-${agentId}-${userId}`, scoped only to agent+user, not to
        // any specific thread) — so every one of a user's conversations
        // with the same agent has been sharing one LangGraph checkpoint,
        // regardless of which named thread the client thought it was
        // resuming. Comparing the populated document's `._id` instead
        // fixes the match without changing anything else about the
        // fallback contract.
        const threadAgentId = thread?.agentId?._id ?? thread?.agentId;
        if (
          thread &&
          thread.userId.toString() === userId.toString() &&
          String(threadAgentId) === String(agentId)
        ) {
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

/**
 * @openapi
 * /api/v1/agui:
 *   get:
 *     tags: [AG-UI]
 *     summary: AG-UI protocol information
 *     description: Returns the AG-UI protocol version and supported capabilities for the streaming agent interface.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Protocol information including version and features
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [AG-UI]
 *     summary: Send a message and stream the agent response (SSE)
 *     description: >
 *       Initiates or resumes an agent conversation via Server-Sent Events (SSE).
 *       The client reads AG-UI protocol events as they arrive — text deltas,
 *       tool calls, tool results, and state snapshots.
 *
 *       This endpoint uses a custom raw-body parser (not express.json()) because
 *       it needs to read the request body before the global JSON middleware
 *       consumes the stream. The LangGraph thread ID is resolved from the
 *       x-thread-id header or auto-generated deterministically from agent+user IDs.
 *
 *       Supports resuming interrupted threads (HITL decisions, tool clarifications)
 *       via the `resume` body field.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: x-agent-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID to chat with
 *       - name: x-thread-id
 *         in: header
 *         schema:
 *           type: string
 *         description: Thread ID to resume — omit for a new conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 description: Array of conversation messages
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *               resume:
 *                 type: object
 *                 description: >
 *                   Resume data for interrupted threads. For HITL decisions,
 *                   pass `{ type: "decision", decision: "continue" }`. For
 *                   tool clarification, pass the answer value.
 *     responses:
 *       200:
 *         description: SSE event stream of AG-UI protocol events
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream of AG-UI protocol events
 *       400:
 *         description: Bad request — missing agent ID or invalid body
 *       401:
 *         description: Unauthorized
 */
aguiRouter.get('/', aguiController.getProtocolInfo);

// POST / — SSE agent run (with rate limiting)
aguiRouter.post('/', rateLimiter('CHAT', RATE_LIMITS.CHAT), aguiController.runAgent);

export default aguiRouter;
