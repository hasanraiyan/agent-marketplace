import Conversation from '../src/modules/threads/thread.model.js';

/**
 * Developer Platform PR-13 (AD-03, blueprint Phase 6, first slice):
 * additive-only `domain` field on the Thread (Conversation) model, part of
 * the `(domain, subject, agentId)` runtime identity invariant. Mirrors
 * PR-8's Agent domain-field treatment. Schema-only assertions — no DB
 * connection needed.
 */
describe('Thread model — domain field', () => {
  const minimalValidThread = {
    agentId: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439022',
    threadId: 'thread-' + Math.random().toString(36).slice(2),
  };

  test('defaults domain to "persona" when not specified, with zero controller changes required', () => {
    const thread = new Conversation(minimalValidThread);
    expect(thread.domain).toBe('persona');
  });

  test('accepts an explicit domain, for future Project-scoped Threads', () => {
    const thread = new Conversation({ ...minimalValidThread, domain: '507f1f77bcf86cd799439099' });
    expect(thread.domain).toBe('507f1f77bcf86cd799439099');
  });

  test('existing required-field validation is unaffected by the new field', async () => {
    const thread = new Conversation({ ...minimalValidThread, threadId: undefined });
    await expect(thread.validate()).rejects.toThrow();
  });

  test('a fully valid document (including the new default field) passes validation', async () => {
    const thread = new Conversation(minimalValidThread);
    await expect(thread.validate()).resolves.toBeUndefined();
  });
});
