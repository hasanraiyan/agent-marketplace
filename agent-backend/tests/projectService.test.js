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

jest.unstable_mockModule('../src/modules/audit/auditLog.service.js', () => ({
  default: { record: jest.fn() },
}));

const projectRepository = (await import('../src/modules/projects/project.repository.js')).default;
const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
const auditLogService = (await import('../src/modules/audit/auditLog.service.js')).default;
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
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'project.created',
          actorContextType: 'PersonaUser',
          actorIdentity: personaUserId,
          targetDomain: mockProject._id,
        })
      );
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
      const result = await projectService.updateMetadata(
        mockProject._id,
        { name: 'New Name' },
        personaUserId
      );
      expect(result).toEqual(updated);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'project.metadata_updated',
          actorContextType: 'ProjectAdmin',
          actorIdentity: personaUserId,
          targetDomain: mockProject._id,
        })
      );
    });

    test('throws NotFoundError when the Project does not exist', async () => {
      projectRepository.updateMetadata.mockResolvedValue(null);
      await expect(
        projectService.updateMetadata('missing-id', { name: 'New Name' }, personaUserId)
      ).rejects.toThrow('Project not found');
    });
  });

  describe('suspendProject (blueprint Phase 10, PR-49)', () => {
    test('suspends an ACTIVE Project, recording ProjectAdmin authority', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'ACTIVE' });
      const suspended = { ...mockProject, status: 'SUSPENDED' };
      projectRepository.updateStatus.mockResolvedValue(suspended);

      const result = await projectService.suspendProject(personaUserId, mockProject._id);

      expect(projectRepository.updateStatus).toHaveBeenCalledWith(mockProject._id, 'SUSPENDED', {
        suspendedAt: expect.any(Date),
        suspendedByAuthority: 'ProjectAdmin',
        suspendedByPersonaUserId: personaUserId,
      });
      expect(result).toEqual(suspended);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'project.suspended', actorIdentity: personaUserId })
      );
    });

    test('rejects suspending a non-ACTIVE Project', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'SUSPENDED' });

      await expect(projectService.suspendProject(personaUserId, mockProject._id)).rejects.toThrow(
        'Only an ACTIVE Project can be suspended'
      );
      expect(projectRepository.updateStatus).not.toHaveBeenCalled();
    });

    test('throws NotFoundError for a nonexistent Project', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(projectService.suspendProject(personaUserId, 'missing-id')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('reactivateProject (blueprint Phase 10, PR-49)', () => {
    test('reactivates a Project suspended by its own ProjectAdmin', async () => {
      projectRepository.findById.mockResolvedValue({
        ...mockProject,
        status: 'SUSPENDED',
        suspendedByAuthority: 'ProjectAdmin',
      });
      const reactivated = { ...mockProject, status: 'ACTIVE' };
      projectRepository.updateStatus.mockResolvedValue(reactivated);

      const result = await projectService.reactivateProject(mockProject._id, personaUserId);

      expect(projectRepository.updateStatus).toHaveBeenCalledWith(mockProject._id, 'ACTIVE', {
        suspendedAt: null,
        suspendedByAuthority: null,
        suspendedByPersonaUserId: null,
      });
      expect(result).toEqual(reactivated);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'project.reactivated', actorIdentity: personaUserId })
      );
    });

    test('rejects reactivating a Project that is not SUSPENDED', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'ACTIVE' });

      await expect(projectService.reactivateProject(mockProject._id)).rejects.toThrow(
        'Only a SUSPENDED Project can be reactivated'
      );
      expect(projectRepository.updateStatus).not.toHaveBeenCalled();
    });

    test('rejects a ProjectAdmin restoring a Platform-suspended Project (AD-08 §26 restore-symmetry)', async () => {
      projectRepository.findById.mockResolvedValue({
        ...mockProject,
        status: 'SUSPENDED',
        suspendedByAuthority: 'PlatformAdmin',
      });

      await expect(projectService.reactivateProject(mockProject._id)).rejects.toThrow(
        'can only be restored by one'
      );
      expect(projectRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('platformSuspendProject (blueprint Phase 10, PR-50)', () => {
    test('suspends an ACTIVE Project, recording PlatformAdmin authority', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'ACTIVE' });
      const suspended = { ...mockProject, status: 'SUSPENDED' };
      projectRepository.updateStatus.mockResolvedValue(suspended);

      const result = await projectService.platformSuspendProject(mockProject._id, personaUserId);

      expect(projectRepository.updateStatus).toHaveBeenCalledWith(mockProject._id, 'SUSPENDED', {
        suspendedAt: expect.any(Date),
        suspendedByAuthority: 'PlatformAdmin',
        suspendedByPersonaUserId: null,
      });
      expect(result).toEqual(suspended);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'project.platform_suspended',
          actorContextType: 'PlatformAdmin',
          actorIdentity: personaUserId,
        })
      );
    });

    test('rejects suspending a non-ACTIVE Project', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'DELETING' });

      await expect(projectService.platformSuspendProject(mockProject._id)).rejects.toThrow(
        'Only an ACTIVE Project can be suspended'
      );
      expect(projectRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('platformRestoreProject (blueprint Phase 10, PR-50)', () => {
    test('restores a Project suspended by Platform Admin authority', async () => {
      projectRepository.findById.mockResolvedValue({
        ...mockProject,
        status: 'SUSPENDED',
        suspendedByAuthority: 'PlatformAdmin',
      });
      const restored = { ...mockProject, status: 'ACTIVE' };
      projectRepository.updateStatus.mockResolvedValue(restored);

      const result = await projectService.platformRestoreProject(mockProject._id, personaUserId);

      expect(projectRepository.updateStatus).toHaveBeenCalledWith(mockProject._id, 'ACTIVE', {
        suspendedAt: null,
        suspendedByAuthority: null,
        suspendedByPersonaUserId: null,
      });
      expect(result).toEqual(restored);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'project.platform_restored',
          actorContextType: 'PlatformAdmin',
          actorIdentity: personaUserId,
        })
      );
    });

    test('rejects restoring a Project that is not SUSPENDED', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'ACTIVE' });

      await expect(projectService.platformRestoreProject(mockProject._id)).rejects.toThrow(
        'Only a SUSPENDED Project can be restored'
      );
      expect(projectRepository.updateStatus).not.toHaveBeenCalled();
    });

    test('rejects Platform Admin restoring a Project a ProjectAdmin self-suspended (AD-08 §26 restore-symmetry)', async () => {
      projectRepository.findById.mockResolvedValue({
        ...mockProject,
        status: 'SUSPENDED',
        suspendedByAuthority: 'ProjectAdmin',
      });

      await expect(projectService.platformRestoreProject(mockProject._id)).rejects.toThrow(
        'can only be restored by one'
      );
      expect(projectRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('requestDeletion (blueprint Phase 10, PR-52)', () => {
    test('requests deletion from an ACTIVE Project', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'ACTIVE' });
      const deleting = { ...mockProject, status: 'DELETING' };
      projectRepository.updateStatus.mockResolvedValue(deleting);

      const result = await projectService.requestDeletion(mockProject._id, personaUserId);

      expect(projectRepository.updateStatus).toHaveBeenCalledWith(mockProject._id, 'DELETING', {
        deletionRequestedAt: expect.any(Date),
      });
      expect(result).toEqual(deleting);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'project.deletion_requested',
          actorIdentity: personaUserId,
          targetDomain: mockProject._id,
        })
      );
    });

    test('requests deletion from a SUSPENDED Project', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'SUSPENDED' });
      projectRepository.updateStatus.mockResolvedValue({ ...mockProject, status: 'DELETING' });

      await projectService.requestDeletion(mockProject._id, personaUserId);

      expect(projectRepository.updateStatus).toHaveBeenCalledWith(
        mockProject._id,
        'DELETING',
        expect.any(Object)
      );
    });

    test('rejects requesting deletion of an already-DELETING Project', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'DELETING' });

      await expect(projectService.requestDeletion(mockProject._id, personaUserId)).rejects.toThrow(
        'Only an ACTIVE or SUSPENDED Project can be deleted'
      );
      expect(projectRepository.updateStatus).not.toHaveBeenCalled();
    });

    test('rejects requesting deletion of an already-DELETED Project', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'DELETED' });

      await expect(projectService.requestDeletion(mockProject._id, personaUserId)).rejects.toThrow(
        'Only an ACTIVE or SUSPENDED Project can be deleted'
      );
    });
  });

  describe('cancelDeletion (blueprint Phase 10, PR-52)', () => {
    test('cancels within the grace period, returning the Project to ACTIVE', async () => {
      projectRepository.findById.mockResolvedValue({
        ...mockProject,
        status: 'DELETING',
        deletionRequestedAt: new Date(), // just now — well within the 7-day default
      });
      const reactivated = { ...mockProject, status: 'ACTIVE' };
      projectRepository.updateStatus.mockResolvedValue(reactivated);

      const result = await projectService.cancelDeletion(mockProject._id, personaUserId);

      expect(projectRepository.updateStatus).toHaveBeenCalledWith(mockProject._id, 'ACTIVE', {
        deletionRequestedAt: null,
        suspendedAt: null,
        suspendedByAuthority: null,
        suspendedByPersonaUserId: null,
      });
      expect(result).toEqual(reactivated);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'project.deletion_cancelled',
          actorIdentity: personaUserId,
        })
      );
    });

    test('rejects cancelling a Project that is not DELETING', async () => {
      projectRepository.findById.mockResolvedValue({ ...mockProject, status: 'ACTIVE' });

      await expect(projectService.cancelDeletion(mockProject._id, personaUserId)).rejects.toThrow(
        'Only a Project pending deletion can have its deletion cancelled'
      );
      expect(projectRepository.updateStatus).not.toHaveBeenCalled();
    });

    test('rejects cancelling once the grace period has elapsed', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      projectRepository.findById.mockResolvedValue({
        ...mockProject,
        status: 'DELETING',
        deletionRequestedAt: eightDaysAgo,
      });

      await expect(projectService.cancelDeletion(mockProject._id, personaUserId)).rejects.toThrow(
        'grace period has already elapsed'
      );
      expect(projectRepository.updateStatus).not.toHaveBeenCalled();
    });
  });
});
