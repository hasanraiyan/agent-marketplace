import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/users/user.repository.js', () => ({
  default: { delete: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: { deleteAllBySubject: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: { cleanupThreads: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: { deleteManyByOwner: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/skills/skill.repository.js', () => ({
  default: { deleteManyByOwner: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/providers/provider.repository.js', () => ({
  default: { deleteManyByOwner: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/mcp/mcp.repository.js', () => ({
  default: { deleteManyByOwner: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/mcp/mcp-user-connection.repository.js', () => ({
  default: { deleteManyByUser: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/projects/projectMembership.service.js', () => ({
  default: { findSoleActiveAdminProject: jest.fn() },
}));

const userRepository = (await import('../src/modules/users/user.repository.js')).default;
const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const checkpointService = (await import('../src/modules/threads/checkpoint.service.js')).default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const skillRepository = (await import('../src/modules/skills/skill.repository.js')).default;
const providerRepository = (await import('../src/modules/providers/provider.repository.js'))
  .default;
const mcpRepository = (await import('../src/modules/mcp/mcp.repository.js')).default;
const mcpUserConnectionRepository = (
  await import('../src/modules/mcp/mcp-user-connection.repository.js')
).default;
const projectMembershipService = (
  await import('../src/modules/projects/projectMembership.service.js')
).default;

const { default: userService } = await import('../src/modules/users/user.service.js');

describe('User Service — deleteUser', () => {
  const userId = 'user_1';

  beforeEach(() => {
    jest.clearAllMocks();
    projectMembershipService.findSoleActiveAdminProject.mockResolvedValue(null);
    threadRepository.deleteAllBySubject.mockResolvedValue({ threadIds: [] });
  });

  test('deletes the user and cascades when they are not the sole Admin of any ACTIVE Project', async () => {
    threadRepository.deleteAllBySubject.mockResolvedValue({ threadIds: ['t1', 't2'] });
    userRepository.delete.mockResolvedValue(true);

    const result = await userService.deleteUser(userId);

    expect(projectMembershipService.findSoleActiveAdminProject).toHaveBeenCalledWith(userId);
    expect(checkpointService.cleanupThreads).toHaveBeenCalledWith(['t1', 't2']);
    expect(agentRepository.deleteManyByOwner).toHaveBeenCalledWith(userId);
    expect(skillRepository.deleteManyByOwner).toHaveBeenCalledWith(userId);
    expect(providerRepository.deleteManyByOwner).toHaveBeenCalledWith(userId);
    expect(mcpRepository.deleteManyByOwner).toHaveBeenCalledWith(userId);
    expect(mcpUserConnectionRepository.deleteManyByUser).toHaveBeenCalledWith(userId);
    expect(userRepository.delete).toHaveBeenCalledWith(userId);
    expect(result).toBe(true);
  });

  test('never cleans up checkpoints when there are no threads', async () => {
    threadRepository.deleteAllBySubject.mockResolvedValue({ threadIds: [] });

    await userService.deleteUser(userId);

    expect(checkpointService.cleanupThreads).not.toHaveBeenCalled();
  });

  describe('blueprint Phase 10, PR-54, AD-08 §13 — last-Admin precondition', () => {
    test('rejects deletion when the user is the sole Admin of an ACTIVE Project, before any cascade side effects', async () => {
      projectMembershipService.findSoleActiveAdminProject.mockResolvedValue({
        _id: 'project_1',
        name: 'Beyond Campus',
        status: 'ACTIVE',
      });

      await expect(userService.deleteUser(userId)).rejects.toThrow(
        /sole remaining Admin of the ACTIVE Project "Beyond Campus"/
      );

      expect(threadRepository.deleteAllBySubject).not.toHaveBeenCalled();
      expect(agentRepository.deleteManyByOwner).not.toHaveBeenCalled();
      expect(userRepository.delete).not.toHaveBeenCalled();
    });

    test('proceeds normally when findSoleActiveAdminProject resolves null', async () => {
      projectMembershipService.findSoleActiveAdminProject.mockResolvedValue(null);
      userRepository.delete.mockResolvedValue(true);

      await expect(userService.deleteUser(userId)).resolves.toBe(true);
      expect(userRepository.delete).toHaveBeenCalledWith(userId);
    });
  });
});
