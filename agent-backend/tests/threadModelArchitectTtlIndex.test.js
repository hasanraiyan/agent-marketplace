import Conversation from '../src/modules/threads/thread.model.js';
import { ARCHITECT_AGENT_ID } from '../src/modules/agents/architectConstants.js';

/**
 * Schema-only assertion (no DB connection) that the Architect's ("Sage")
 * own thread has a partial TTL index scoped exactly to
 * ARCHITECT_AGENT_ID — every other agent's threads must be unaffected.
 */
describe('Thread model — Architect thread TTL index', () => {
  const ttlIndex = Conversation.schema
    .indexes()
    .find(([, options]) => options.name === 'architect_thread_ttl');

  test('is registered on lastMessageAt', () => {
    expect(ttlIndex).toBeDefined();
    expect(ttlIndex[0]).toEqual({ lastMessageAt: 1 });
  });

  test('expires after 30 days', () => {
    expect(ttlIndex[1].expireAfterSeconds).toBe(60 * 60 * 24 * 30);
  });

  test('is scoped only to the Architect sentinel agentId', () => {
    expect(String(ttlIndex[1].partialFilterExpression.agentId)).toBe(ARCHITECT_AGENT_ID);
  });
});
