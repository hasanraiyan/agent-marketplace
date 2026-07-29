import KnowledgeBase from '../src/modules/knowledge/knowledge-base.model.js';

/**
 * Developer Platform PR-11 (AD-03, AD-04, blueprint Phase 4): additive-only
 * `domain`/`ownerType` fields on the KnowledgeBase model, mirroring PR-8's
 * Agent treatment. Schema-only assertions — no DB connection needed.
 */
describe('KnowledgeBase model — domain/ownerType fields', () => {
  const minimalValidKb = {
    name: 'Test KB',
    ownerId: '507f1f77bcf86cd799439011',
    qdrantCollectionName: 'kb-test-collection',
  };

  test('defaults domain to "persona" when not specified', () => {
    const kb = new KnowledgeBase(minimalValidKb);
    expect(kb.domain).toBe('persona');
  });

  test('defaults ownerType to "PersonaUser" when not specified', () => {
    const kb = new KnowledgeBase(minimalValidKb);
    expect(kb.ownerType).toBe('PersonaUser');
  });

  test('accepts explicit domain and ownerType values, for future Project/ExternalUser-owned Knowledge Bases', () => {
    const kb = new KnowledgeBase({
      ...minimalValidKb,
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'Project',
    });
    expect(kb.domain).toBe('507f1f77bcf86cd799439099');
    expect(kb.ownerType).toBe('Project');
  });

  test('rejects an ownerType outside the supported enum', async () => {
    const kb = new KnowledgeBase({ ...minimalValidKb, ownerType: 'NotARealOwnerType' });
    await expect(kb.validate()).rejects.toThrow();
  });

  test('a fully valid document (including the new default fields) passes validation', async () => {
    const kb = new KnowledgeBase(minimalValidKb);
    await expect(kb.validate()).resolves.toBeUndefined();
  });
});
