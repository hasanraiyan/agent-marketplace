import { jest } from '@jest/globals';
import skillRepository from '../src/modules/skills/skill.repository.js';
import Skill from '../src/modules/skills/skill.model.js';

/**
 * Developer Platform PR-12 (AD-03, blueprint Phase 4): domain-scoping fix
 * for skill.repository.js's two public/marketplace-search paths, mirroring
 * PR-9's Agent `_buildSearchFilter` fix. No prior test coverage existed for
 * either of these two functions.
 */
describe('Skill Repository — Domain scoping for public/marketplace search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findPublicSkills', () => {
    test('defaults to the Persona Domain when no domain is given', async () => {
      const findSpy = jest.spyOn(Skill, 'find').mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([]),
      });
      jest.spyOn(Skill, 'countDocuments').mockResolvedValue(0);

      await skillRepository.findPublicSkills({}, 0, 20);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: true, domain: 'persona' })
      );
    });

    test('respects an explicit domain filter', async () => {
      const findSpy = jest.spyOn(Skill, 'find').mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([]),
      });
      jest.spyOn(Skill, 'countDocuments').mockResolvedValue(0);

      await skillRepository.findPublicSkills({ domain: 'some-project-id' }, 0, 20);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: true, domain: 'some-project-id' })
      );
    });
  });

  describe('searchSkills', () => {
    test('non-"mine" scope defaults to the Persona Domain', async () => {
      const findSpy = jest.spyOn(Skill, 'find').mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });

      await skillRepository.searchSkills('user_1', { q: 'test', scope: 'public' });

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: true, domain: 'persona' })
      );
    });

    test('"mine" scope is unaffected — no domain key added, owner-scoped only', async () => {
      const findSpy = jest.spyOn(Skill, 'find').mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });

      await skillRepository.searchSkills('user_1', { q: 'test', scope: 'mine' });

      const calledFilter = findSpy.mock.calls[0][0];
      expect(calledFilter.ownerId).toBe('user_1');
      expect(calledFilter.domain).toBeUndefined();
      expect(calledFilter.isPublic).toBeUndefined();
    });
  });
});
