import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import threadRepository from '../threads/thread.repository.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import { ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
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
    let threadDbId = req.headers['x-thread-id'] || req.query.threadId;
    // Virtual ids from the frontend's lazy-create flow (run/page.jsx sets
    // `_id: "new"` until the first message persists the thread). Treat them
    // as "no thread yet" so we fall back to deterministic langGraph id rather
    // than trying to look up a document that can never exist.
    if (threadDbId === 'new' || (typeof threadDbId === 'string' && threadDbId.startsWith('new-'))) {
      threadDbId = null;
    }

    let langGraphThreadId = agentId ? `agui-${agentId}-${userId}` : null;
    if (agentId && threadDbId) {
      // A thread must match both the requesting user AND the agent it was
      // created with — a thread must not be resumable (checkpoint history
      // read, new messages persisted onto it) by a different user, or under
      // a different agent's config via a mismatched `x-agent-id`.
      //
      // `thread.agentId` comes back POPULATED (thread.repository.js's
      // findById always populates it for display purposes), so it must be
      // compared via its `._id` — comparing the populated document itself
      // with a bare id string never matches (blueprint Phase 9, PR-42 fix).
      const thread = await threadRepository.findById(threadDbId).catch(() => null);
      const threadAgentId = thread?.agentId?._id ?? thread?.agentId;
      // The Architect's sentinel id has no real Agent document, so its
      // `agentId` ref never resolves — Mongoose populate nulls out an
      // unresolvable ref instead of leaving the raw id, and
      // thread.controller.js's create() is the only path that allows a
      // thread to reference a nonexistent agent, exclusively for this
      // sentinel. So a populated-null agentId reliably means "this is an
      // Architect thread" and can't be spoofed by claiming the sentinel
      // against a thread whose (real, existing) agent actually populated.
      const agentMatches =
        (agentId === ARCHITECT_AGENT_ID && thread?.agentId == null) ||
        String(threadAgentId) === String(agentId);
      const belongsToCaller =
        thread && thread.userId.toString() === userId.toString() && agentMatches;

      if (!belongsToCaller) {
        // A threadId was explicitly given but doesn't resolve to one of the
        // caller's own Threads for this Agent — reject rather than silently
        // resuming the deterministic fallback conversation instead (an
        // earlier version of this route fell back silently instead, PR-15;
        // that meant a caller had no way to tell "my threadId was honored"
        // from "it silently resumed a different conversation," which is
        // worse than a clear error). Message is generic — doesn't
        // distinguish "no such thread" from "not yours" from "wrong agent"
        // — to avoid leaking which case applies.
        throw new NotFoundError('Thread not found');
      }

      langGraphThreadId = thread.threadId;
      await threadRepository.touchLastMessageAt(thread._id);
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
 *       404:
 *         description: >
 *           Agent not found, or `x-thread-id` was given but doesn't resolve to
 *           one of the caller's own Threads for this Agent.
 */
aguiRouter.get('/', aguiController.getProtocolInfo);

// POST / — SSE agent run (with rate limiting)
aguiRouter.post('/', rateLimiter('CHAT', RATE_LIMITS.CHAT), aguiController.runAgent);

export default aguiRouter;
