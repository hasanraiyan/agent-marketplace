import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/skills/skill.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByOwner: jest.fn(),
    findPublicSkills: jest.fn(),
    searchSkills: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: {
    findAgentsUsingSkill: jest.fn(),
    removeSkillFromAgents: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: {
    invalidate: jest.fn(),
  },
}));

const skillRepository = (await import('../src/modules/skills/skill.repository.js')).default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const skillService = (await import('../src/modules/skills/skill.service.js')).default;

describe('Skill Service — ownership generalization (blueprint Phase 9, PR-28)', () => {
  const mockUserId = 'user_123';

  beforeEach(() => {
    jest.clearAllMocks();
    agentRepository.findAgentsUsingSkill.mockResolvedValue([]);
  });

  describe('createSkill', () => {
    test('defaults to a PersonaUser-owned Skill when no context is given', async () => {
      skillRepository.create.mockResolvedValue({ _id: 's1' });

      await skillService.createSkill(mockUserId, { name: 'test-skill' });

      expect(skillRepository.create).toHaveBeenCalledWith({
        name: 'test-skill',
        ownerType: 'PersonaUser',
        ownerId: mockUserId,
      });
    });

    test('creates a Project-owned Skill for a ProjectMachineContext', async () => {
      skillRepository.create.mockResolvedValue({ _id: 's1' });
      const context = { domain: 'project-1', principalType: 'ProjectMachine' };

      await skillService.createSkill('irrelevant', { name: 'support-skill' }, context);

      expect(skillRepository.create).toHaveBeenCalledWith({
        name: 'support-skill',
        domain: 'project-1',
        ownerType: 'Project',
      });
    });

    test('creates an ExternalUser-owned Skill for a ProjectRuntimeContext', async () => {
      skillRepository.create.mockResolvedValue({ _id: 's1' });
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      };

      await skillService.createSkill('irrelevant', { name: 'my-skill' }, context);

      expect(skillRepository.create).toHaveBeenCalledWith({
        name: 'my-skill',
        domain: 'project-1',
        ownerType: 'ExternalUser',
        externalOwnerId: 'sabik',
      });
    });
  });

  describe('getSkillById', () => {
    function makeSkill(overrides = {}) {
      return {
        _id: 's1',
        ownerType: 'ExternalUser',
        externalOwnerId: 'sabik',
        domain: 'project-1',
        isPublic: false,
        toObject: function () {
          return { ...this };
        },
        ...overrides,
      };
    }

    test('the owning ExternalUser context can see its own private Skill', async () => {
      skillRepository.findById.mockResolvedValue(makeSkill());
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      };

      const result = await skillService.getSkillById('s1', 'irrelevant', context);
      expect(result.isOwner).toBe(true);
    });

    test('a different external user cannot see the private Skill', async () => {
      skillRepository.findById.mockResolvedValue(makeSkill());
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'someone_else',
      };

      await expect(skillService.getSkillById('s1', 'irrelevant', context)).rejects.toThrow(
        'Skill not found or private'
      );
    });

    test('a different external user CAN see a public Skill, but is not flagged as owner', async () => {
      skillRepository.findById.mockResolvedValue(makeSkill({ isPublic: true }));
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'someone_else',
      };

      const result = await skillService.getSkillById('s1', 'irrelevant', context);
      expect(result.isOwner).toBe(false);
    });

    test('with no context argument, behaves exactly like the Persona default', async () => {
      skillRepository.findById.mockResolvedValue({
        _id: 's1',
        ownerType: 'PersonaUser',
        ownerId: mockUserId,
        isPublic: false,
        toObject: function () {
          return { ...this };
        },
      });

      const result = await skillService.getSkillById('s1', mockUserId);
      expect(result.isOwner).toBe(true);
    });
  });

  describe('updateSkill', () => {
    test('a ProjectMachineContext can update its own Project-owned Skill', async () => {
      skillRepository.update.mockResolvedValue({ _id: 's1', name: 'renamed' });
      const context = { domain: 'project-1', principalType: 'ProjectMachine' };

      await skillService.updateSkill('s1', 'irrelevant', { name: 'renamed' }, context);

      expect(skillRepository.update).toHaveBeenCalledWith(
        's1',
        { domain: 'project-1', ownerType: 'Project' },
        { name: 'renamed' }
      );
    });

    test('with no context argument, filters by ownerId exactly like before', async () => {
      skillRepository.update.mockResolvedValue({ _id: 's1', name: 'renamed' });

      await skillService.updateSkill('s1', mockUserId, { name: 'renamed' });

      expect(skillRepository.update).toHaveBeenCalledWith(
        's1',
        { ownerId: mockUserId },
        { name: 'renamed' }
      );
    });

    test('strips ownerId/externalOwnerId/ownerType/domain from the update payload', async () => {
      skillRepository.update.mockResolvedValue({ _id: 's1' });

      await skillService.updateSkill('s1', mockUserId, {
        name: 'renamed',
        ownerType: 'Project',
        domain: 'attacker-project',
        externalOwnerId: 'attacker',
      });

      const [, , calledUpdateData] = skillRepository.update.mock.calls[0];
      expect(calledUpdateData.ownerType).toBeUndefined();
      expect(calledUpdateData.domain).toBeUndefined();
      expect(calledUpdateData.externalOwnerId).toBeUndefined();
      expect(calledUpdateData.name).toBe('renamed');
    });

    test('invalidates the AgentFactory cache for every Agent using this Skill', async () => {
      skillRepository.update.mockResolvedValue({ _id: 's1' });
      agentRepository.findAgentsUsingSkill.mockResolvedValue([{ _id: 'a1' }, { _id: 'a2' }]);

      await skillService.updateSkill('s1', mockUserId, { name: 'renamed' });

      expect(agentFactory.invalidate).toHaveBeenCalledWith('a1');
      expect(agentFactory.invalidate).toHaveBeenCalledWith('a2');
    });
  });

  describe('deleteSkill', () => {
    test('an ExternalUser context can delete its own Skill', async () => {
      skillRepository.findById.mockResolvedValue({
        _id: 's1',
        ownerType: 'ExternalUser',
        externalOwnerId: 'sabik',
        domain: 'project-1',
      });
      skillRepository.delete.mockResolvedValue(true);
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      };

      await skillService.deleteSkill('s1', 'irrelevant', context);

      expect(skillRepository.delete).toHaveBeenCalledWith('s1', {
        domain: 'project-1',
        ownerType: 'ExternalUser',
        externalOwnerId: 'sabik',
      });
    });

    test('a different external user is rejected before any side effects', async () => {
      skillRepository.findById.mockResolvedValue({
        _id: 's1',
        ownerType: 'ExternalUser',
        externalOwnerId: 'sabik',
        domain: 'project-1',
      });
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'someone_else',
      };

      await expect(skillService.deleteSkill('s1', 'irrelevant', context)).rejects.toThrow(
        'Unauthorized to delete this skill'
      );
      expect(agentRepository.removeSkillFromAgents).not.toHaveBeenCalled();
      expect(skillRepository.delete).not.toHaveBeenCalled();
    });

    test('with no context argument, still rejects a non-owner Persona user', async () => {
      skillRepository.findById.mockResolvedValue({
        _id: 's1',
        ownerType: 'PersonaUser',
        ownerId: mockUserId,
      });

      await expect(skillService.deleteSkill('s1', 'someone_else')).rejects.toThrow(
        'Unauthorized to delete this skill'
      );
    });
  });
});
