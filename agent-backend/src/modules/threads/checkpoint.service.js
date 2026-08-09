import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import threadRepository from './thread.repository.js';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { MongoClient } from 'mongodb';
import { loggerService } from '../../utils/index.js';
import { personaExecutionContext, isThreadSubject } from './thread.service.js';
// Lazy/circular with agent.factory.js (it imports checkpointService the other
// way) — safe because both only touch each other inside method bodies, never
// at module-evaluation time. See agentFactory's own getGlobalStore() for the
// existing instance of this same pattern.
import agentFactory from '../agents/agent.factory.js';
import { describeInterrupt } from '../agui/aguiTranslator.js';

const logger = loggerService.getLogger();

class CheckpointService {
  constructor() {
    if (process.env.MONGODB_URI) {
      this.mongoClient = new MongoClient(process.env.MONGODB_URI);
      this.mongoClient.connect().catch(console.error);
      this.checkpointer = new MongoDBSaver({ client: this.mongoClient });
    }
  }

  async _autoTitleThread(thread, firstUserMessage, llm) {
    try {
      const titlePrompt = [
        new SystemMessage(
          'You are a helpful assistant. Provide a highly concise, 3 to 4 word summary of the user prompt. Output ONLY the summary. Example: "React Bug Fix" or "Python Setup Guide"'
        ),
        new HumanMessage(firstUserMessage),
      ];

      const response = await llm.invoke(titlePrompt);
      const newTitle = response.content.replace(/["']/g, '').trim();

      await threadRepository.update(thread._id, { title: newTitle });
      return newTitle;
    } catch (error) {
      console.error('Failed to auto-title thread:', error.message);
    }
  }

  /**
   * Permanently removes LangGraph checkpoint data for one or more threads.
   * This ensures that when a thread is deleted from our primary collection,
   * its history is also purged from the checkpointer storage.
   */
  async cleanupThreads(threadIds) {
    if (!this.mongoClient || !threadIds || (Array.isArray(threadIds) && threadIds.length === 0)) {
      return;
    }

    const ids = Array.isArray(threadIds) ? threadIds : [threadIds];

    try {
      const db = this.mongoClient.db();
      // MongoDBSaver default collection names are 'checkpoints' and 'checkpoint_writes'
      const checkpointColl = db.collection('checkpoints');
      const checkpointWritesColl = db.collection('checkpoint_writes');

      const [cpResult, cwResult] = await Promise.all([
        checkpointColl.deleteMany({ thread_id: { $in: ids } }),
        checkpointWritesColl.deleteMany({ thread_id: { $in: ids } }),
      ]);

      logger.info(
        `[CheckpointService] Purged checkpoints for ${ids.length} threads. ` +
          `Deleted ${cpResult.deletedCount} checkpoints and ${cwResult.deletedCount} writes.`
      );
    } catch (error) {
      logger.error('[CheckpointService] Failed to cleanup thread checkpoints:', error);
    }
  }

  /**
   * Developer Platform (blueprint Phase 9, PR-39): `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for the
   * existing Persona `GET /threads/:id/messages` route.
   *
   * `pendingInterrupt` closes a gap every SDK consumer (OnlyFounders,
   * BeyondCampus) hit independently: reloading a thread paused on a HITL/
   * clarification interrupt didn't re-show the approval card until the next
   * live stream re-surfaced it. Raw `channel_values` (the checkpoint tuple
   * this method already reads) doesn't carry interrupt data — LangGraph
   * derives `tasks[].interrupts` from `pendingWrites` against the live graph
   * structure, only available via `agentInstance.getState()`. Reusing
   * `agentFactory.buildAgent()` (cached per agentId after the first call —
   * see agent.factory.js) rather than re-deriving that logic here, exactly
   * mirroring the same check `agui.service.js` already does before resuming
   * a live run.
   */
  async getMessages(threadId, userId, context = personaExecutionContext(userId)) {
    const thread = await threadRepository.findById(threadId);
    if (!thread) throw new Error('Thread not found');
    if (!isThreadSubject(thread, context)) throw new Error('Unauthorized');

    const snapshot = await this.checkpointer.getTuple({
      configurable: { thread_id: thread.threadId },
    });

    // Subagent timelines live on the thread doc, not in checkpoints — see
    // agui.routes.js where they are folded from the live stream.
    const subagentTraces = thread.subagentTraces || {};

    let pendingInterrupt;
    if (thread.agentId) {
      try {
        const { agentInstance } = await agentFactory.buildAgent(
          thread.agentId,
          userId,
          this.checkpointer,
          context
        );
        const state = await agentInstance.getState({
          configurable: { thread_id: thread.threadId },
        });
        const interrupts = (state?.tasks || []).flatMap((t) => t.interrupts || []);
        if (interrupts.length > 0) {
          const info = describeInterrupt(interrupts);
          // Reshaped into the same { kind, value } envelope the live
          // hitl_request/clarification_request CUSTOM events carry (see
          // aguiTranslator.js) — not describeInterrupt()'s own raw fields —
          // so SDK consumers can feed this straight into the identical
          // handling they already have for the live-stream case.
          pendingInterrupt =
            info.kind === 'hitl'
              ? { kind: 'hitl', value: { actionRequests: info.actionRequests, reviewConfigs: info.reviewConfigs } }
              : { kind: 'clarification', value: { questions: info.questions, currentIndex: 0 } };
        }
      } catch (err) {
        logger.warn('[CheckpointService] failed to check graph state for interrupts', {
          threadId,
          err: err.message,
        });
      }
    }

    if (!snapshot || !snapshot.checkpoint || !snapshot.checkpoint.channel_values) {
      return { messages: [], state: {}, subagentTraces, pendingInterrupt };
    }

    const { messages = [], ...state } = snapshot.checkpoint.channel_values;
    return { messages, state, subagentTraces, pendingInterrupt };
  }
}

export default new CheckpointService();
