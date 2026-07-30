import Skill from '../src/modules/skills/skill.model.js';

/**
 * Developer Platform PR-27 (AD-04, blueprint Phase 9): generalizes Skill
 * ownership so a Project or ExternalUser can own a Skill, mirroring
 * Agent's PR-24 treatment exactly. Schema-only assertions — no DB
 * connection needed.
 */
describe('Skill model — ownership generalization (ownerId / externalOwnerId)', () => {
  const minimalPersonaSkill = {
    ownerId: '507f1f77bcf86cd799439011',
    name: 'test-skill',
    description: 'A test skill.',
    instructions: 'Do the thing.',
  };

  test('defaults externalOwnerId to null', () => {
    const skill = new Skill(minimalPersonaSkill);
    expect(skill.externalOwnerId).toBeNull();
  });

  test('existing behavior unaffected: ownerId is still required for a (default) PersonaUser-owned Skill', async () => {
    const skill = new Skill({ ...minimalPersonaSkill, ownerId: undefined });
    await expect(skill.validate()).rejects.toThrow();
  });

  test('a Project-owned Skill validates with neither ownerId nor externalOwnerId', async () => {
    const skill = new Skill({
      name: 'support-skill',
      description: 'A test skill.',
      instructions: 'Do the thing.',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'Project',
    });
    await expect(skill.validate()).resolves.toBeUndefined();
    expect(skill.ownerId).toBeUndefined();
    expect(skill.externalOwnerId).toBeNull();
  });

  test('an ExternalUser-owned Skill validates with externalOwnerId and no ownerId', async () => {
    const skill = new Skill({
      name: 'sabik-skill',
      description: 'A test skill.',
      instructions: 'Do the thing.',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
      externalOwnerId: 'sabik',
    });
    await expect(skill.validate()).resolves.toBeUndefined();
    expect(skill.ownerId).toBeUndefined();
  });

  test('an ExternalUser-owned Skill without externalOwnerId fails validation', async () => {
    const skill = new Skill({
      name: 'sabik-skill',
      description: 'A test skill.',
      instructions: 'Do the thing.',
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
    });
    await expect(skill.validate()).rejects.toThrow();
  });
});
