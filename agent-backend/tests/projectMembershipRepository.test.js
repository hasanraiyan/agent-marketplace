import { jest } from '@jest/globals';
import projectMembershipRepository from '../src/modules/projects/projectMembership.repository.js';
import ProjectMembership from '../src/modules/projects/projectMembership.model.js';

describe('ProjectMembership Repository', () => {
  let mockMembership;
  const projectId = '507f1f77bcf86cd799439099';
  const personaUserId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();

    mockMembership = {
      _id: '507f1f77bcf86cd799439077',
      project: projectId,
      personaUserId,
      role: 'Admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn(),
    };
    mockMembership.save.mockResolvedValue(mockMembership);
  });

  describe('create', () => {
    test('creates a membership via save()', async () => {
      const saveSpy = jest
        .spyOn(ProjectMembership.prototype, 'save')
        .mockResolvedValue(mockMembership);

      const result = await projectMembershipRepository.create({
        project: projectId,
        personaUserId,
        role: 'Admin',
      });

      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual(mockMembership);
    });
  });

  describe('findByProjectAndUser', () => {
    test('finds a membership by compound key', async () => {
      jest.spyOn(ProjectMembership, 'findOne').mockResolvedValue(mockMembership);

      const result = await projectMembershipRepository.findByProjectAndUser(
        projectId,
        personaUserId
      );

      expect(ProjectMembership.findOne).toHaveBeenCalledWith({ project: projectId, personaUserId });
      expect(result).toEqual(mockMembership);
    });

    test('returns null when no membership exists', async () => {
      jest.spyOn(ProjectMembership, 'findOne').mockResolvedValue(null);

      const result = await projectMembershipRepository.findByProjectAndUser(
        projectId,
        'nonexistent-user'
      );

      expect(result).toBeNull();
    });
  });

  describe('findByProject', () => {
    test('lists all memberships for a Project, oldest first', async () => {
      jest.spyOn(ProjectMembership, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockMembership]),
      });

      const result = await projectMembershipRepository.findByProject(projectId);

      expect(ProjectMembership.find).toHaveBeenCalledWith({ project: projectId });
      expect(result).toEqual([mockMembership]);
    });
  });

  describe('countAdminsByProject', () => {
    test('counts only Admin-role memberships for the Project', async () => {
      jest.spyOn(ProjectMembership, 'countDocuments').mockResolvedValue(2);

      const result = await projectMembershipRepository.countAdminsByProject(projectId);

      expect(ProjectMembership.countDocuments).toHaveBeenCalledWith({
        project: projectId,
        role: 'Admin',
      });
      expect(result).toBe(2);
    });
  });

  describe('delete', () => {
    test('deletes a membership by compound key', async () => {
      jest.spyOn(ProjectMembership, 'findOneAndDelete').mockResolvedValue(mockMembership);

      const result = await projectMembershipRepository.delete(projectId, personaUserId);

      expect(ProjectMembership.findOneAndDelete).toHaveBeenCalledWith({
        project: projectId,
        personaUserId,
      });
      expect(result).toEqual(mockMembership);
    });
  });

  describe('deleteAllByProject', () => {
    test('deletes every membership for a Project', async () => {
      jest.spyOn(ProjectMembership, 'deleteMany').mockResolvedValue({ deletedCount: 3 });

      const result = await projectMembershipRepository.deleteAllByProject(projectId);

      expect(ProjectMembership.deleteMany).toHaveBeenCalledWith({ project: projectId });
      expect(result.deletedCount).toBe(3);
    });
  });

  describe('deleteAllByUser', () => {
    test('deletes every membership for a Persona User across all Projects', async () => {
      jest.spyOn(ProjectMembership, 'deleteMany').mockResolvedValue({ deletedCount: 2 });

      const result = await projectMembershipRepository.deleteAllByUser(personaUserId);

      expect(ProjectMembership.deleteMany).toHaveBeenCalledWith({ personaUserId });
      expect(result.deletedCount).toBe(2);
    });
  });
});
