import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/projectMembership.repository.js', () => ({
  default: {
    create: jest.fn(),
    findByProjectAndUser: jest.fn(),
    findByProject: jest.fn(),
    countAdminsByProject: jest.fn(),
    delete: jest.fn(),
  },
}));

const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
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
      projectMembershipRepository.create.mockResolvedValue({
        project: projectId,
        personaUserId: raiyanId,
        role: 'Admin',
      });

      await projectMembershipService.addMember(projectId, raiyanId);

      expect(projectMembershipRepository.create).toHaveBeenCalledWith({
        project: projectId,
        personaUserId: raiyanId,
        role: 'Admin',
      });
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

      const result = await projectMembershipService.removeMember(projectId, raiyanId);

      expect(projectMembershipRepository.delete).toHaveBeenCalledWith(projectId, raiyanId);
      expect(result.personaUserId).toBe(raiyanId);
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
});
