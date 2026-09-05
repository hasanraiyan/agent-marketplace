import { loggerService } from '../../utils/index.js';
import voiceThreadService from './voiceThread.service.js';

const logger = loggerService.getLogger();

/**
 * Serializes a live voice session's committed transcript turns into the
 * thread's checkpoint (voice-agent-plan.md §4.2, §4.3).
 *
 * - One instance per machine voice session, created in the gateway only when
 *   the session is ProjectRuntime (Studio admin test sessions stay
 *   ephemeral — they have no thread to persist to).
 * - Every commit is chained onto a single promise queue so consecutive
 *   read-modify-write checkpoint updates can never interleave (two interleaved
 *   reads would both append from the same base and one append would be lost).
 * - commit() is fire-and-forget from the caller's perspective: a persistence
 *   failure is logged and swallowed, never allowed to break the audio call.
 * - flush() runs after the socket closes: it waits for the queue to drain and
 *   then fires the end-of-call auto-title from the first user turn.
 */
class VoiceTranscriptSink {
  /**
   * @param {object} params
   * @param {string} params.agentId
   * @param {string} params.userId - acting Subject id (externalUserId)
   * @param {*} params.context - reconstructed ProjectRuntimeContext
   * @param {string} params.threadId - LangGraph thread id (from claims)
   */
  constructor({ agentId, userId, context, threadId }) {
    this.agentId = agentId;
    this.userId = userId;
    this.context = context;
    this.threadId = threadId;

    this.queue = Promise.resolve();
    this.firstUserText = null;
  }

  /** Enqueue one committed transcript line. Never throws to the caller. */
  commit(role, text) {
    const content = typeof text === 'string' ? text.trim() : '';
    if (!content) return;

    if (role === 'user' && !this.firstUserText) {
      this.firstUserText = content;
    }

    const args = {
      agentId: this.agentId,
      userId: this.userId,
      context: this.context,
      threadId: this.threadId,
    };

    this.queue = this.queue
      .then(() => voiceThreadService.appendTurns(args, [{ role, text: content }]))
      .catch((err) => {
        // Persistence must never break the call — log and continue.
        logger.warn('[Voice] transcript commit failed (non-fatal)', {
          threadId: this.threadId,
          role,
          err: err?.message,
        });
      });
  }

  /** Drain the queue, then auto-title the thread from its first user turn. */
  async flush() {
    await this.queue.catch(() => {});
    if (!this.firstUserText) return;
    try {
      await voiceThreadService.autoTitleFromFirstTurn(
        {
          agentId: this.agentId,
          userId: this.userId,
          context: this.context,
          threadId: this.threadId,
        },
        this.firstUserText
      );
    } catch (err) {
      logger.warn('[Voice] end-of-call flush failed (non-fatal)', { err: err?.message });
    }
  }
}

export default VoiceTranscriptSink;
