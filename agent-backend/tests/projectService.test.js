import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/project.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findByIds: jest.fn(),
    updateMetadata: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectMembership.repository.js', () => ({
  default: {
    create: jest.fn(),
    findByProjectAndUser: jest.fn(),
    findByProject: jest.fn(),
    findByUser: jest.fn(),
    countAdminsByProject: jest.fn(),
    delete: jest.fn(),
  },
}));

const projectRepository = (await import('../src/modules/projects/project.repository.js')).default;
const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;

describe('Project Service', () => {
  const personaUserId = '507f1f77bcf86cd799439011';
  const personaContext = { domain: 'persona', principalType: 'PersonaUser', personaUserId };
  let mockProject;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProject = {
      _id: '507f1f77bcf86cd799439099',
      name: 'Beyond Campus',
      createdBy: personaUserId,
    };
  });

  describe('createProject', () => {
    test('creates the Project with createdBy set from the persona context, then grants the creator an Admin membership', async () => {
      projectRepository.create.mockResolvedValue(mockProject);
      projectMembershipRepository.create.mockResolvedValue({
        project: mockProject._id,
        personaUserId,
        role: 'Admin',
      });

      const result = await projectService.createProject(personaContext, { name: 'Beyond Campus' });

      expect(projectRepository.create).toHaveBeenCalledWith({
        name: 'Beyond Campus',
        description: undefined,
        slug: undefined,
        createdBy: personaUserId,
      });
      expect(projectMembershipRepository.create).toHaveBeenCalledWith({
        project: mockProject._id,
        personaUserId,
        role: 'Admin',
      });
      expect(result).toEqual(mockProject);
    });

    test('never accepts a caller-supplied createdBy — it always comes from personaContext.personaUserId', async () => {
      projectRepository.create.mockResolvedValue(mockProject);
      projectMembershipRepository.create.mockResolvedValue({});

      await projectService.createProject(personaContext, {
        name: 'Beyond Campus',
        // @ts-expect-error attempting to smuggle a different creator id
        createdBy: 'attacker-supplied-id',
      });

      expect(projectRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: personaUserId })
      );
    });

    test('throws when personaContext has no personaUserId', async () => {
      await expect(projectService.createProject({}, { name: 'x' })).rejects.toThrow(
        /PersonaPrincipalContext with personaUserId is required/
      );
      expect(projectRepository.create).not.toHaveBeenCalled();
    });

    test('throws when personaContext is missing entirely', async () => {
      await expect(projectService.createProject(undefined, { name: 'x' })).rejects.toThrow(
        /PersonaPrincipalContext with personaUserId is required/
      );
    });

    test('compensating rollback: deletes the just-created Project when the membership write fails', async () => {
      projectRepository.create.mockResolvedValue(mockProject);
      const membershipError = new Error('membership write failed');
      projectMembershipRepository.create.mockRejectedValue(membershipError);
      projectRepository.delete.mockResolvedValue(mockProject);

      await expect(
        projectService.createProject(personaContext, { name: 'Beyond Campus' })
      ).rejects.toThrow('membership write failed');

      expect(projectRepository.delete).toHaveBeenCalledWith(mockProject._id);
    });

    test('rollback is best-effort: the original membership error still propagates even if the compensating delete also fails', async () => {
      projectRepository.create.mockResolvedValue(mockProject);
      const membershipError = new Error('membership write failed');
      projectMembershipRepository.create.mockRejectedValue(membershipError);
      projectRepository.delete.mockRejectedValue(new Error('delete also failed'));

      await expect(
        projectService.createProject(personaContext, { name: 'Beyond Campus' })
      ).rejects.toThrow('membership write failed');
    });
  });

  describe('listProjectsForUser', () => {
    test('resolves memberships to their Projects', async () => {
      const otherProjectId = '507f1f77bcf86cd799439088';
      projectMembershipRepository.findByUser.mockResolvedValue([
        { project: mockProject._id, personaUserId, role: 'Admin' },
        { project: otherProjectId, personaUserId, role: 'Admin' },
      ]);
      projectRepository.findByIds.mockResolvedValue([mockProject]);

      const result = await projectService.listProjectsForUser(personaUserId);

      expect(projectMembershipRepository.findByUser).toHaveBeenCalledWith(personaUserId);
      expect(projectRepository.findByIds).toHaveBeenCalledWith([mockProject._id, otherProjectId]);
      expect(result).toEqual([mockProject]);
    });

    test('returns an empty array without querying Projects when the user has no memberships', async () => {
      projectMembershipRepository.findByUser.mockResolvedValue([]);

      const result = await projectService.listProjectsForUser(personaUserId);

      expect(result).toEqual([]);
      expect(projectRepository.findByIds).not.toHaveBeenCalled();
    });
  });

  describe('getProjectById', () => {
    test('returns the Project when found', async () => {
      projectRepository.findById.mockResolvedValue(mockProject);
      const result = await projectService.getProjectById(mockProject._id);
      expect(result).toEqual(mockProject);
    });

    test('throws NotFoundError when the Project does not exist', async () => {
      projectRepository.findById.mockResolvedValue(null);
      await expect(projectService.getProjectById('missing-id')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('updateMetadata', () => {
    test('returns the updated Project', async () => {
      const updated = { ...mockProject, name: 'New Name' };
      projectRepository.updateMetadata.mockResolvedValue(updated);
      const result = await projectService.updateMetadata(mockProject._id, { name: 'New Name' });
      expect(result).toEqual(updated);
    });

    test('throws NotFoundError when the Project does not exist', async () => {
      projectRepository.updateMetadata.mockResolvedValue(null);
      await expect(
        projectService.updateMetadata('missing-id', { name: 'New Name' })
      ).rejects.toThrow('Project not found');
    });
  });
});
