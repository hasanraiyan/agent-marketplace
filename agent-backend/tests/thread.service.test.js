import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findBySubject: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteAllBySubject: jest.fn(),
  },
}));

const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const {
  default: threadService,
  isThreadSubject,
  subjectFilterForContext,
  subjectFieldsForContext,
} = await import('../src/modules/threads/thread.service.js');

describe('Thread Service — Subject generalization (blueprint Phase 9, PR-39)', () => {
  const mockUserId = 'user_1';
  const runtimeContext = {
    domain: 'project-1',
    principalType: 'ProjectRuntime',
    externalUserId: 'sabik',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isThreadSubject', () => {
    test('recognizes the PersonaUser subject via matching userId', () => {
      const thread = { userId: mockUserId, subjectType: 'PersonaUser' };
      const context = {
        domain: 'persona',
        principalType: 'PersonaUser',
        personaUserId: mockUserId,
      };
      expect(isThreadSubject(thread, context)).toBe(true);
    });

    test('rejects a different PersonaUser', () => {
      const thread = { userId: mockUserId, subjectType: 'PersonaUser' };
      const context = {
        domain: 'persona',
        principalType: 'PersonaUser',
        personaUserId: 'someone-else',
      };
      expect(isThreadSubject(thread, context)).toBe(false);
    });

    test('recognizes the ExternalUser subject via matching externalUserId + domain', () => {
      const thread = {
        domain: 'project-1',
        subjectType: 'ExternalUser',
        externalUserId: 'sabik',
      };
      expect(isThreadSubject(thread, runtimeContext)).toBe(true);
    });

    test('rejects a different ExternalUser in the same Project', () => {
      const thread = {
        domain: 'project-1',
        subjectType: 'ExternalUser',
        externalUserId: 'someone-else',
      };
      expect(isThreadSubject(thread, runtimeContext)).toBe(false);
    });

    test('rejects an ExternalUser-subject thread from a different Domain', () => {
      const thread = {
        domain: 'project-2',
        subjectType: 'ExternalUser',
        externalUserId: 'sabik',
      };
      expect(isThreadSubject(thread, runtimeContext)).toBe(false);
    });
  });

  describe('subjectFilterForContext / subjectFieldsForContext', () => {
    test('Persona context builds a bare { userId } filter', () => {
      const context = {
        domain: 'persona',
        principalType: 'PersonaUser',
        personaUserId: mockUserId,
      };
      expect(subjectFilterForContext(context)).toEqual({ userId: mockUserId });
      expect(subjectFieldsForContext(context)).toEqual({
        subjectType: 'PersonaUser',
        userId: mockUserId,
      });
    });

    test('ProjectRuntime context builds a domain-qualified ExternalUser filter', () => {
      expect(subjectFilterForContext(runtimeContext)).toEqual({
        domain: 'project-1',
        subjectType: 'ExternalUser',
        externalUserId: 'sabik',
      });
      expect(subjectFieldsForContext(runtimeContext)).toEqual({
        domain: 'project-1',
        subjectType: 'ExternalUser',
        externalUserId: 'sabik',
      });
    });
  });

  describe('createThread', () => {
    test('defaults to a PersonaUser-subject Thread when no context is given', async () => {
      threadRepository.create.mockResolvedValue({ _id: 't1' });

      await threadService.createThread(mockUserId, { agentId: 'agent_1', threadId: 'uuid-1' });

      expect(threadRepository.create).toHaveBeenCalledWith({
        agentId: 'agent_1',
        threadId: 'uuid-1',
        subjectType: 'PersonaUser',
        userId: mockUserId,
      });
    });

    test('creates an ExternalUser-subject Thread for a ProjectRuntimeContext', async () => {
      threadRepository.create.mockResolvedValue({ _id: 't1' });

      await threadService.createThread(
        'irrelevant',
        { agentId: 'agent_1', threadId: 'uuid-1' },
        runtimeContext
      );

      expect(threadRepository.create).toHaveBeenCalledWith({
        agentId: 'agent_1',
        threadId: 'uuid-1',
        domain: 'project-1',
        subjectType: 'ExternalUser',
        externalUserId: 'sabik',
      });
    });
  });

  describe('getThreadById', () => {
    test('throws "Thread not found" when owned by a different subject', async () => {
      threadRepository.findById.mockResolvedValue({ userId: 'someone-else' });

      await expect(threadService.getThreadById('t1', mockUserId)).rejects.toThrow(
        'Thread not found'
      );
    });

    test('returns the thread when the subject matches', async () => {
      const thread = { userId: mockUserId };
      threadRepository.findById.mockResolvedValue(thread);

      await expect(threadService.getThreadById('t1', mockUserId)).resolves.toEqual(thread);
    });

    test('recognizes the ExternalUser subject for a ProjectRuntimeContext caller', async () => {
      const thread = { domain: 'project-1', subjectType: 'ExternalUser', externalUserId: 'sabik' };
      threadRepository.findById.mockResolvedValue(thread);

      await expect(
        threadService.getThreadById('t1', 'irrelevant', runtimeContext)
      ).resolves.toEqual(thread);
    });
  });

  describe('getThreadsForSubject', () => {
    test('lists via the Subject filter, not a bare userId', async () => {
      threadRepository.findBySubject.mockResolvedValue([]);

      await threadService.getThreadsForSubject(
        'irrelevant',
        { page: 1, limit: 20 },
        runtimeContext
      );

      expect(threadRepository.findBySubject).toHaveBeenCalledWith(
        { domain: 'project-1', subjectType: 'ExternalUser', externalUserId: 'sabik' },
        { page: 1, limit: 20 }
      );
    });
  });

  describe('updateThreadTitle', () => {
    test('rejects a cross-subject update', async () => {
      threadRepository.findById.mockResolvedValue({ userId: 'someone-else' });

      await expect(threadService.updateThreadTitle('t1', mockUserId, 'New Title')).rejects.toThrow(
        'Thread not found'
      );
      expect(threadRepository.update).not.toHaveBeenCalled();
    });

    test('updates when the subject matches', async () => {
      threadRepository.findById.mockResolvedValue({ userId: mockUserId });
      threadRepository.update.mockResolvedValue({ title: 'New Title' });

      await threadService.updateThreadTitle('t1', mockUserId, 'New Title');

      expect(threadRepository.update).toHaveBeenCalledWith('t1', { title: 'New Title' });
    });
  });

  describe('deleteThread', () => {
    test('rejects a cross-subject delete', async () => {
      threadRepository.findById.mockResolvedValue({ userId: 'someone-else' });

      await expect(threadService.deleteThread('t1', mockUserId)).rejects.toThrow(
        'Thread not found'
      );
      expect(threadRepository.delete).not.toHaveBeenCalled();
    });

    test('deletes when the subject matches', async () => {
      threadRepository.findById.mockResolvedValue({ userId: mockUserId });
      threadRepository.delete.mockResolvedValue({ threadId: 'uuid-1' });

      const result = await threadService.deleteThread('t1', mockUserId);

      expect(threadRepository.delete).toHaveBeenCalledWith('t1');
      expect(result).toEqual({ threadId: 'uuid-1' });
    });
  });

  describe('deleteAllThreadsForSubject', () => {
    test('deletes via the Subject filter, not a bare userId', async () => {
      threadRepository.deleteAllBySubject.mockResolvedValue({ deletedCount: 0, threadIds: [] });

      await threadService.deleteAllThreadsForSubject('irrelevant', runtimeContext);

      expect(threadRepository.deleteAllBySubject).toHaveBeenCalledWith({
        domain: 'project-1',
        subjectType: 'ExternalUser',
        externalUserId: 'sabik',
      });
    });
  });
});
