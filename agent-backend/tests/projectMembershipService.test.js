import { jest } from '@jest/globals';

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

jest.unstable_mockModule('../src/modules/projects/project.repository.js', () => ({
  default: { findById: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/audit/auditLog.service.js', () => ({
  default: { record: jest.fn() },
}));

const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
const projectRepository = (await import('../src/modules/projects/project.repository.js')).default;
const auditLogService = (await import('../src/modules/audit/auditLog.service.js')).default;
const projectMembershipService = (
  await import('../src/modules/projects/projectMembership.service.js')
).default;

describe('ProjectMembership Service', () => {
  const projectId = '507f1f77bcf86cd799439099';
  const raiyanId = '507f1f77bcf86cd799439011';
  const sabikId = '507f1f77bcf86cd799439022';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addMember', () => {
    test('defaults to the Admin role', async () => {
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);
      projectMembershipRepository.create.mockResolvedValue({
        project: projectId,
        personaUserId: raiyanId,
        role: 'Admin',
      });

      await projectMembershipService.addMember(projectId, raiyanId, undefined, sabikId);

      expect(projectMembershipRepository.create).toHaveBeenCalledWith({
        project: projectId,
        personaUserId: raiyanId,
        role: 'Admin',
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'membership.added',
          actorIdentity: sabikId,
          targetDomain: projectId,
          targetResourceId: raiyanId,
        })
      );
    });

    test('rejects re-adding an existing member with a friendly error instead of an E11000/500', async () => {
      // e.g. the Project creator adding themselves — their membership already
      // exists (AD-08 §9's unique compound index would throw E11000).
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
        project: projectId,
        personaUserId: raiyanId,
        role: 'Admin',
      });

      await expect(
        projectMembershipService.addMember(projectId, raiyanId, undefined, sabikId)
      ).rejects.toThrow('User is already a member of this Project');
      expect(projectMembershipRepository.create).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    test('maps a concurrent duplicate-key (E11000) from create to the same friendly error', async () => {
      // The pre-check can race with a simultaneous request; the unique index
      // is the final backstop and must not leak as a raw 500.
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);
      projectMembershipRepository.create.mockRejectedValue(
        Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
      );

      await expect(
        projectMembershipService.addMember(projectId, raiyanId, undefined, sabikId)
      ).rejects.toThrow('User is already a member of this Project');
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe('removeMember — last-Admin invariant (AD-08 §12)', () => {
    test('blocks removal when the target is the sole remaining Admin', async () => {
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
        project: projectId,
        personaUserId: raiyanId,
        role: 'Admin',
      });
      projectMembershipRepository.countAdminsByProject.mockResolvedValue(1);

      await expect(projectMembershipService.removeMember(projectId, raiyanId)).rejects.toThrow(
        /Cannot remove the last remaining Admin/
      );
      expect(projectMembershipRepository.delete).not.toHaveBeenCalled();
    });

    test('allows removal when at least one other Admin remains', async () => {
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
        project: projectId,
        personaUserId: raiyanId,
        role: 'Admin',
      });
      projectMembershipRepository.countAdminsByProject.mockResolvedValue(2);
      projectMembershipRepository.delete.mockResolvedValue({
        project: projectId,
        personaUserId: raiyanId,
        role: 'Admin',
      });

      const result = await projectMembershipService.removeMember(projectId, raiyanId, sabikId);

      expect(projectMembershipRepository.delete).toHaveBeenCalledWith(projectId, raiyanId);
      expect(result.personaUserId).toBe(raiyanId);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'membership.removed',
          actorIdentity: sabikId,
          targetDomain: projectId,
          targetResourceId: raiyanId,
        })
      );
    });

    test('skips the admin-count check entirely when the target membership is not an Admin', async () => {
      // v1's schema only ever creates 'Admin' memberships, but the service's
      // own branching logic (membership.role === 'Admin') is written
      // defensively for a future lesser role (AD-08 §9/§40). This proves
      // that branch, independent of what the schema currently allows: a
      // non-Admin membership is removable without ever consulting the
      // admin count, even when that count happens to be 1 elsewhere.
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
        project: projectId,
        personaUserId: sabikId,
        role: 'Member', // a hypothetical future non-Admin role
      });
      projectMembershipRepository.countAdminsByProject.mockResolvedValue(1);
      projectMembershipRepository.delete.mockResolvedValue({
        project: projectId,
        personaUserId: sabikId,
        role: 'Member',
      });

      const result = await projectMembershipService.removeMember(projectId, sabikId);

      expect(projectMembershipRepository.countAdminsByProject).not.toHaveBeenCalled();
      expect(projectMembershipRepository.delete).toHaveBeenCalledWith(projectId, sabikId);
      expect(result.personaUserId).toBe(sabikId);
    });

    test('throws NotFoundError, not a last-admin error, when the membership does not exist at all', async () => {
      projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);

      await expect(
        projectMembershipService.removeMember(projectId, 'never-was-a-member')
      ).rejects.toThrow('Project membership not found');
      expect(projectMembershipRepository.countAdminsByProject).not.toHaveBeenCalled();
      expect(projectMembershipRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('listMembers', () => {
    test('delegates to the repository', async () => {
      const members = [{ personaUserId: raiyanId, role: 'Admin' }];
      projectMembershipRepository.findByProject.mockResolvedValue(members);

      const result = await projectMembershipService.listMembers(projectId);

      expect(projectMembershipRepository.findByProject).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(members);
    });
  });

  describe('findSoleActiveAdminProject (blueprint Phase 10, PR-54, AD-08 §13)', () => {
    test('returns the ACTIVE Project when the user is its sole Admin', async () => {
      projectMembershipRepository.findByUser.mockResolvedValue([
        { project: projectId, personaUserId: raiyanId, role: 'Admin' },
      ]);
      projectRepository.findById.mockResolvedValue({
        _id: projectId,
        name: 'Beyond Campus',
        status: 'ACTIVE',
      });
      projectMembershipRepository.countAdminsByProject.mockResolvedValue(1);

      const result = await projectMembershipService.findSoleActiveAdminProject(raiyanId);

      expect(result).toEqual(expect.objectContaining({ _id: projectId, name: 'Beyond Campus' }));
    });

    test('returns null when another Admin also exists', async () => {
      projectMembershipRepository.findByUser.mockResolvedValue([
        { project: projectId, personaUserId: raiyanId, role: 'Admin' },
      ]);
      projectRepository.findById.mockResolvedValue({ _id: projectId, status: 'ACTIVE' });
      projectMembershipRepository.countAdminsByProject.mockResolvedValue(2);

      const result = await projectMembershipService.findSoleActiveAdminProject(raiyanId);

      expect(result).toBeNull();
    });

    test('returns null when the sole-Admin Project is not ACTIVE (e.g. SUSPENDED)', async () => {
      projectMembershipRepository.findByUser.mockResolvedValue([
        { project: projectId, personaUserId: raiyanId, role: 'Admin' },
      ]);
      projectRepository.findById.mockResolvedValue({ _id: projectId, status: 'SUSPENDED' });

      const result = await projectMembershipService.findSoleActiveAdminProject(raiyanId);

      expect(result).toBeNull();
      expect(projectMembershipRepository.countAdminsByProject).not.toHaveBeenCalled();
    });

    test('ignores non-Admin memberships entirely', async () => {
      projectMembershipRepository.findByUser.mockResolvedValue([
        { project: projectId, personaUserId: raiyanId, role: 'Member' },
      ]);

      const result = await projectMembershipService.findSoleActiveAdminProject(raiyanId);

      expect(result).toBeNull();
      expect(projectRepository.findById).not.toHaveBeenCalled();
    });

    test('returns null when the user has no memberships at all', async () => {
      projectMembershipRepository.findByUser.mockResolvedValue([]);

      const result = await projectMembershipService.findSoleActiveAdminProject(raiyanId);

      expect(result).toBeNull();
    });
  });
});
