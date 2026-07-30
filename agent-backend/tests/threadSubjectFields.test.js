import Conversation from '../src/modules/threads/thread.model.js';

/**
 * Developer Platform PR-22 (AD-02, blueprint Phase 8): additive-only
 * `subjectType`/`externalUserId` fields on the Thread (Conversation)
 * model, letting a Thread belong to a Project's ExternalUser subject
 * instead of only a Persona User. Schema-only assertions — no DB
 * connection needed.
 */
describe('Thread model — subject fields (subjectType / externalUserId)', () => {
  const minimalPersonaThread = {
    agentId: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439022',
    threadId: 'thread-' + Math.random().toString(36).slice(2),
  };

  test('defaults subjectType to "PersonaUser" when not specified', () => {
    const thread = new Conversation(minimalPersonaThread);
    expect(thread.subjectType).toBe('PersonaUser');
  });

  test('defaults externalUserId to null', () => {
    const thread = new Conversation(minimalPersonaThread);
    expect(thread.externalUserId).toBeNull();
  });

  test('existing behavior unaffected: userId is still required for a (default) PersonaUser-subject Thread', async () => {
    const thread = new Conversation({ ...minimalPersonaThread, userId: undefined });
    await expect(thread.validate()).rejects.toThrow();
  });

  test('a fully valid PersonaUser-subject document (including the new default fields) passes validation', async () => {
    const thread = new Conversation(minimalPersonaThread);
    await expect(thread.validate()).resolves.toBeUndefined();
  });

  test('an ExternalUser-subject Thread validates with externalUserId and no userId', async () => {
    const thread = new Conversation({
      agentId: '507f1f77bcf86cd799439011',
      threadId: 'thread-' + Math.random().toString(36).slice(2),
      subjectType: 'ExternalUser',
      externalUserId: 'sabik',
    });
    await expect(thread.validate()).resolves.toBeUndefined();
    expect(thread.userId).toBeUndefined();
  });

  test('an ExternalUser-subject Thread without externalUserId fails validation', async () => {
    const thread = new Conversation({
      agentId: '507f1f77bcf86cd799439011',
      threadId: 'thread-' + Math.random().toString(36).slice(2),
      subjectType: 'ExternalUser',
    });
    await expect(thread.validate()).rejects.toThrow();
  });

  test('rejects a subjectType outside the supported enum', async () => {
    const thread = new Conversation({ ...minimalPersonaThread, subjectType: 'NotARealType' });
    await expect(thread.validate()).rejects.toThrow();
  });
});
