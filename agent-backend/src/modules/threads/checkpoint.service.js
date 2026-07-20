import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import threadRepository from './thread.repository.js';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { MongoClient } from 'mongodb';
import { loggerService } from '../../utils/index.js';

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

  async getMessages(threadId, userId) {
    const thread = await threadRepository.findById(threadId);
    if (!thread) throw new Error('Thread not found');
    if (thread.userId.toString() !== userId.toString()) throw new Error('Unauthorized');

    const snapshot = await this.checkpointer.getTuple({
      configurable: { thread_id: thread.threadId },
    });

    // Subagent timelines live on the thread doc, not in checkpoints — see
    // agui.routes.js where they are folded from the live stream.
    const subagentTraces = thread.subagentTraces || {};

    if (!snapshot || !snapshot.checkpoint || !snapshot.checkpoint.channel_values) {
      return { messages: [], state: {}, subagentTraces };
    }

    const { messages = [], ...state } = snapshot.checkpoint.channel_values;
    return { messages, state, subagentTraces };
  }
}

export default new CheckpointService();
