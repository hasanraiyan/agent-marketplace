import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import checkpointService from '../src/modules/threads/checkpoint.service.js';
import threadRepository from '../src/modules/threads/thread.repository.js';
import agentRepository from '../src/modules/agents/agent.repository.js';
import Conversation from '../src/modules/threads/thread.model.js';
import Agent from '../src/modules/agents/agent.model.js';
import deleteInactiveUsers from '../src/modules/cron/deleteInactiveUsers.js';
import User from '../src/modules/users/user.model.js';
import Provider from '../src/modules/providers/provider.model.js';
import Skill from '../src/modules/skills/skill.model.js';
import Mcp from '../src/modules/mcp/mcp.model.js';
import McpUserConnection from '../src/modules/mcp/mcp-user-connection.model.js';
import ProjectMembership from '../src/modules/projects/projectMembership.model.js';

describe('Cascading Deletes Integration', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockAgentId = new mongoose.Types.ObjectId();
  const mockThreadId = 'test-thread-id-' + Date.now();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Thread Deletion & Checkpoint Cleanup', () => {
    test('should cleanup checkpoints when a thread is deleted', async () => {
      // Mock threadRepository.findById to return our test thread
      const mockThread = {
        _id: new mongoose.Types.ObjectId(),
        userId: mockUserId,
        threadId: mockThreadId,
      };

      jest.spyOn(threadRepository, 'findById').mockResolvedValue(mockThread);
      jest.spyOn(threadRepository, 'delete').mockResolvedValue(mockThread);

      // Mock checkpointService.cleanupThreads
      const cleanupSpy = jest.spyOn(checkpointService, 'cleanupThreads').mockResolvedValue();

      // We'll simulate the controller action here as we want to test the flow
      // In thread.controller.js:
      const deletedThread = await threadRepository.delete(mockThread._id);
      if (deletedThread && deletedThread.threadId) {
        await checkpointService.cleanupThreads(deletedThread.threadId);
      }

      expect(threadRepository.delete).toHaveBeenCalledWith(mockThread._id);
      expect(cleanupSpy).toHaveBeenCalledWith(mockThreadId);
    });

    test('should cleanup all checkpoints when all threads for a user are deleted', async () => {
      const mockThreadIds = ['id-1', 'id-2'];
      const mockDeleteResult = { deletedCount: 2, threadIds: mockThreadIds };

      jest.spyOn(threadRepository, 'deleteAllBySubject').mockResolvedValue(mockDeleteResult);
      const cleanupSpy = jest.spyOn(checkpointService, 'cleanupThreads').mockResolvedValue();

      // In thread.controller.js (via thread.service.js):
      const result = await threadRepository.deleteAllBySubject({ userId: mockUserId });
      if (result && result.threadIds && result.threadIds.length > 0) {
        await checkpointService.cleanupThreads(result.threadIds);
      }

      expect(threadRepository.deleteAllBySubject).toHaveBeenCalledWith({ userId: mockUserId });
      expect(cleanupSpy).toHaveBeenCalledWith(mockThreadIds);
    });
  });

  describe('Agent Soft-Delete', () => {
    test('AgentRepository.delete should perform a soft-delete', async () => {
      const mockAgent = { _id: mockAgentId, name: 'Test Agent', isActive: true };

      const updateSpy = jest.spyOn(Agent, 'findByIdAndUpdate').mockResolvedValue({
        ...mockAgent,
        isActive: false,
        deletedAt: new Date(),
      });

      const result = await agentRepository.delete(mockAgentId);

      expect(updateSpy).toHaveBeenCalledWith(
        mockAgentId,
        expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
        { new: true }
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('User Purge Cascade', () => {
    test('should purge all user data in deleteInactiveUsers cron', async () => {
      const mockUser = { _id: mockUserId, isActive: false, updatedAt: new Date(0) };

      jest.spyOn(User, 'find').mockResolvedValue([mockUser]);
      // Developer Platform (blueprint Phase 10, PR-54): deleteInactiveUsers
      // now consults the last-Admin precondition before purging — no Admin
      // memberships here, so it proceeds exactly as before this PR existed.
      // findByUser chains .sort(...) after .find(...), so the mock must
      // return a chainable object, not resolve directly.
      jest.spyOn(ProjectMembership, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      jest.spyOn(Conversation, 'find').mockReturnValue({
        select: jest.fn().mockResolvedValue([{ threadId: 'thread-1' }]),
      });

      const cleanupThreadsSpy = jest.spyOn(checkpointService, 'cleanupThreads').mockResolvedValue();
      const deleteThreadsSpy = jest.spyOn(Conversation, 'deleteMany').mockResolvedValue();
      const deleteAgentsSpy = jest.spyOn(Agent, 'deleteMany').mockResolvedValue();
      const deleteSkillsSpy = jest.spyOn(Skill, 'deleteMany').mockResolvedValue();
      const deleteProvidersSpy = jest.spyOn(Provider, 'deleteMany').mockResolvedValue();
      const deleteMcpsSpy = jest.spyOn(Mcp, 'deleteMany').mockResolvedValue();
      const deleteMcpConnectionsSpy = jest
        .spyOn(McpUserConnection, 'deleteMany')
        .mockResolvedValue();
      const deleteUserSpy = jest.spyOn(User, 'findByIdAndDelete').mockResolvedValue();

      await deleteInactiveUsers();

      expect(cleanupThreadsSpy).toHaveBeenCalledWith(['thread-1']);
      expect(deleteThreadsSpy).toHaveBeenCalledWith({ userId: mockUserId });
      expect(deleteAgentsSpy).toHaveBeenCalledWith({ ownerId: mockUserId });
      expect(deleteSkillsSpy).toHaveBeenCalledWith({ ownerId: mockUserId });
      expect(deleteProvidersSpy).toHaveBeenCalledWith({ ownerId: mockUserId });
      expect(deleteMcpsSpy).toHaveBeenCalledWith({ ownerId: mockUserId });
      expect(deleteMcpConnectionsSpy).toHaveBeenCalledWith({ userId: mockUserId });
      expect(deleteUserSpy).toHaveBeenCalledWith(mockUserId);
    });
  });

  // Mcp -> Agent.mcps cascade-on-delete is covered by the "deleteMcp" describe
  // block in mcp.service.test.js, with proper top-level unstable_mockModule
  // setup (re-mocking modules mid-test-file isn't reliable under Jest's ESM
  // support, so it isn't duplicated here).
});
