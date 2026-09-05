import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { loggerService } from '../../utils/index.js';
import agentFactory from '../agents/agent.factory.js';
import checkpointService from '../threads/checkpoint.service.js';
import threadRepository from '../threads/thread.repository.js';
import { isThreadSubject } from '../threads/thread.service.js';

const logger = loggerService.getLogger();

/**
 * Seed budget — the earlier-conversation excerpt injected into a voice
 * session's systemInstruction is bounded (it rides inside the Live prompt
 * window, and the model only needs recent context, not the whole thread).
 * contextWindowCompression absorbs overflow beyond this.
 */
const SEED_MAX_TURNS = 20;
const SEED_MAX_CHARS = 8000;

/** Extract plain text from a LangChain message's content (string | blocks). */
function extractContentText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => (typeof block === 'string' ? block : block?.text ?? ''))
      .join('');
  }
  return '';
}

/** Build a LangChain message for a committed voice transcript line. */
export function voiceTurnToMessage(role, text) {
  const content = typeof text === 'string' ? text.trim() : '';
  if (!content) return null;
  return role === 'user' ? new HumanMessage(content) : new AIMessage(content);
}

/**
 * Voice thread/checkpoint I/O (voice-agent-plan.md §4.2, §4.4).
 *
 * The one link between a voice session and the Persona Thread model: a text
 * thread's history IS the LangGraph Mongo checkpoint keyed by
 * `thread.threadId` (channel_values.messages of LangChain BaseMessages), so
 * voice reads that channel to seed the call and writes its turns back into
 * it — there is no separate messages collection.
 *
 * Everything here uses the compiled DeepAgents graph as a pure
 * getState/updateState handle: it is NEVER streamed and NEVER run. The agent
 * instance (and its llm) come from the SAME cached `agentFactory.buildAgent`
 * the text runtime uses, so the first voice call on an agent pays the
 * compile and every later one is a cache hit.
 *
 * Every method is best-effort by contract — a persistence failure must never
 * break the audio call. Callers wrap these in try/catch and degrade to
 * ephemeral (current) behavior on error; nothing here throws outward by
 * design, but callers still guard against the unexpected.
 */
class VoiceThreadService {
  /**
   * Resolves (cached) the compiled graph handle + llm for an Agent. Mirrors
   * agui.service.js's buildAgent call: userId is the acting Subject id,
   * context is the execution context (ProjectRuntimeContext for machine
   * voice sessions).
   *
   * @returns {Promise<{agentInstance: object, llm: object|null}>}
   */
  async _buildHandle({ agentId, userId, context }) {
    const built = await agentFactory.buildAgent(
      agentId,
      userId,
      checkpointService.checkpointer,
      context
    );
    return { agentInstance: built.agentInstance, llm: built.llm ?? null };
  }

  /**
   * Defense-in-depth ownership re-check (voice-agent-plan.md §4.1 step 4).
   * The gateway reconstructs ProjectRuntimeContext from ticket claims only;
   * before this service touches a checkpoint it re-verifies the thread — if
   * it resolves to a real Thread doc it must belong to that context, and if
   * it doesn't resolve (the deterministic scratch id, which is namespaced by
   * domain+agent+externalUserId and therefore cannot collide with another
   * Subject's conversation) it is allowed by construction.
   *
   * @throws {Error} when an explicit thread doc exists but is not this
   *   context's own thread — caller must treat as not-found, never persist.
   */
  async assertThreadOwnedByContext(threadId, context) {
    if (!threadId) return;
    let thread = null;
    try {
      thread = await threadRepository.findById(threadId);
    } catch {
      thread = null;
    }
    // findById also matches the custom threadId field (thread.repository.js),
    // so a hit here means a real Thread doc exists for this LangGraph id.
    if (thread && !isThreadSubject(thread, context)) {
      throw new Error('Voice thread ownership re-check failed');
    }
  }

  /**
   * Reads the thread's raw checkpoint messages (empty array when the thread
   * has never run / has no checkpoint yet).
   */
  async readRawMessages({ agentId, userId, context, threadId }) {
    const { agentInstance } = await this._buildHandle({ agentId, userId, context });
    const state = await agentInstance.getState({
      configurable: { thread_id: threadId },
    });
    return state?.values?.messages ?? [];
  }

  /**
   * Builds the bounded "earlier conversation" excerpt for a voice session's
   * systemInstruction from the thread's existing messages. Empty thread →
   * empty string (nothing to seed). Tool messages are skipped (their content
   * is echoed in the surrounding assistant turn's prose already).
   *
   * @returns {Promise<{excerpt: string, messageCount: number}>}
   */
  async buildSeedSuffix({ agentId, userId, context, threadId }) {
    let raw = [];
    try {
      raw = await this.readRawMessages({ agentId, userId, context, threadId });
    } catch (err) {
      logger.warn('[Voice] seed read failed — starting with empty context', {
        err: err?.message,
      });
      return { excerpt: '', messageCount: 0 };
    }

    const lines = [];
    for (const msg of raw || []) {
      let type;
      try {
        type = typeof msg?.getType === 'function' ? msg.getType() : msg?.type;
      } catch {
        continue;
      }
      if (type === 'tool' || type === 'system') continue;
      const text = extractContentText(msg.content);
      if (!text) continue;
      const speaker = type === 'human' ? 'User' : 'Assistant';
      lines.push(`${speaker}: ${text}`);
      if (lines.length >= SEED_MAX_TURNS * 2) break; // user+assistant pairs
    }

    let joined = lines.join('\n');
    if (joined.length > SEED_MAX_CHARS) {
      joined = `…${joined.slice(-SEED_MAX_CHARS)}`;
    }
    if (!joined) return { excerpt: '', messageCount: raw.length };

    return {
      excerpt:
        '\n\n---\nEarlier conversation in this thread (context only — do not repeat it aloud or summarize it unless asked):\n' +
        joined,
      messageCount: raw.length,
    };
  }

  /**
   * Appends committed voice transcript turns to the thread's checkpoint
   * messages channel.
   *
   * Read-modify-write of the FULL messages array with the messages' own ids
   * (never a partial delta): whether updateState SETs the channel or REDUCEs
   * it through add_messages, rewriting the full array is correct — under
   * add_messages, re-written messages dedupe by id, so previously persisted
   * turns are replaced in place and only the new ones grow the list.
   * Verified against @langchain/langgraph@1.4.5 source: updateState on a
   * never-run thread bootstraps from emptyCheckpoint() rather than failing,
   * so a voice-first conversation persists too.
   *
   * @param {Array<{role: 'user'|'assistant', text: string}>} turns
   */
  async appendTurns({ agentId, userId, context, threadId }, turns) {
    if (!threadId || !turns || turns.length === 0) return;

    const messages = turns
      .map((t) => voiceTurnToMessage(t.role, t.text))
      .filter(Boolean);
    if (messages.length === 0) return;

    await this.assertThreadOwnedByContext(threadId, context);

    const { agentInstance } = await this._buildHandle({ agentId, userId, context });
    const existing = await this.readRawMessages({ agentId, userId, context, threadId });
    await agentInstance.updateState(
      { configurable: { thread_id: threadId } },
      { messages: [...existing, ...messages] }
    );

    logger.debug('[Voice] appended voice turns to thread checkpoint', {
      threadId,
      appended: messages.length,
      total: existing.length + messages.length,
    });
  }

  /**
   * Titles a Thread from the first committed voice user turn — end-of-call,
   * fire-and-forget (voice never runs the graph during the call, so it can't
   * title "during the first run" the way text does; agui.service.js titles
   * live because it IS streaming the graph). Reuses checkpointService's
   * _autoTitleThread (agui.service.js already calls it cross-module) and the
   * graph handle's llm. A deterministic scratch id has no Thread doc → no-op.
   */
  async autoTitleFromFirstTurn({ agentId, userId, context, threadId }, firstUserText) {
    if (!threadId || !firstUserText) return null;
    try {
      const thread = await threadRepository.findById(threadId);
      if (!thread || thread.title !== 'New Conversation') return null;

      const { llm } = await this._buildHandle({ agentId, userId, context });
      if (!llm) return null;

      return await checkpointService._autoTitleThread(thread, firstUserText, llm);
    } catch (err) {
      logger.warn('[Voice] auto-title failed (non-fatal)', { err: err?.message });
      return null;
    }
  }
}

export default new VoiceThreadService();
