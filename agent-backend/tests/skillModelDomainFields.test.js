import Skill from '../src/modules/skills/skill.model.js';

/**
 * Developer Platform PR-11 (AD-03, AD-04, blueprint Phase 4): additive-only
 * `domain`/`ownerType` fields on the Skill model, mirroring PR-8's Agent
 * treatment. Schema-only assertions — no DB connection needed.
 */
describe('Skill model — domain/ownerType fields', () => {
  const minimalValidSkill = {
    ownerId: '507f1f77bcf86cd799439011',
    name: 'test-skill',
    description: 'A test skill.',
    instructions: 'Do the thing.',
  };

  test('defaults domain to "persona" when not specified', () => {
    const skill = new Skill(minimalValidSkill);
    expect(skill.domain).toBe('persona');
  });

  test('defaults ownerType to "PersonaUser" when not specified', () => {
    const skill = new Skill(minimalValidSkill);
    expect(skill.ownerType).toBe('PersonaUser');
  });

  test('accepts explicit domain and ownerType values, for future Project/ExternalUser-owned Skills', () => {
    const skill = new Skill({
      ...minimalValidSkill,
      domain: '507f1f77bcf86cd799439099',
      ownerType: 'ExternalUser',
    });
    expect(skill.domain).toBe('507f1f77bcf86cd799439099');
    expect(skill.ownerType).toBe('ExternalUser');
  });

  test('rejects an ownerType outside the supported enum', async () => {
    const skill = new Skill({ ...minimalValidSkill, ownerType: 'NotARealOwnerType' });
    await expect(skill.validate()).rejects.toThrow();
  });

  test('a fully valid document (including the new default fields) passes validation', async () => {
    const skill = new Skill(minimalValidSkill);
    await expect(skill.validate()).resolves.toBeUndefined();
  });
});
