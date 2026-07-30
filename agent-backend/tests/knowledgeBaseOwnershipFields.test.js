import KnowledgeBase from '../src/modules/knowledge/knowledge-base.model.js';

/**
 * Developer Platform PR-30 (AD-04, blueprint Phase 9): generalizes
 * KnowledgeBase ownership so a Project or ExternalUser can own a
 * Knowledge Base, mirroring Agent's PR-24 / Skill's PR-27 treatment
 * exactly. Schema-only assertions — no DB connection needed.
 */
describe('KnowledgeBase model — ownership generalization (ownerId / externalOwnerId)', () => {
  const minimalPersonaKb = {
    name: 'Test KB',
    ownerId: '507f1f77bcf86cd799439011',
    qdrantCollectionName: 'kb-test-collection-persona',
  };

  test('defaults externalOwnerId to null', () => {
    const kb = new KnowledgeBase(minimalPersonaKb);
    expect(kb.externalOwnerId).toBeNull();
  });

  test('existing behavior unaffected: ownerId is still required for a (default) PersonaUser-owned KB', async () => {
    const kb = new KnowledgeBase({ ...minimalPersonaKb, ownerId: undefined });
    await expect(kb.validate()).rejects.toThrow();
  });

  test('a Project-owned KB validates with neither ownerId nor externalOwnerId', async () => {
    const kb = new KnowledgeBase({
      name: 'Project KB',
      qdrantCollectionName: 'kb-test-collection-project',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'Project',
    });
    await expect(kb.validate()).resolves.toBeUndefined();
    expect(kb.ownerId).toBeUndefined();
    expect(kb.externalOwnerId).toBeNull();
  });

  test('an ExternalUser-owned KB validates with externalOwnerId and no ownerId', async () => {
    const kb = new KnowledgeBase({
      name: 'Sabik KB',
      qdrantCollectionName: 'kb-test-collection-external',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
      externalOwnerId: 'sabik',
    });
    await expect(kb.validate()).resolves.toBeUndefined();
    expect(kb.ownerId).toBeUndefined();
  });

  test('an ExternalUser-owned KB without externalOwnerId fails validation', async () => {
    const kb = new KnowledgeBase({
      name: 'Sabik KB',
      qdrantCollectionName: 'kb-test-collection-external-2',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
    });
    await expect(kb.validate()).rejects.toThrow();
  });
});
