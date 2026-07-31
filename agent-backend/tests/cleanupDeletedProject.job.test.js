import { jest } from '@jest/globals';

const mockDefine = jest.fn();
const mockNow = jest.fn();
jest.unstable_mockModule('../src/modules/jobs/agenda.js', () => ({
  default: { define: mockDefine, now: mockNow },
}));

const mockUnlink = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('fs/promises', () => ({
  default: { unlink: mockUnlink },
  unlink: mockUnlink,
}));

jest.unstable_mockModule('../src/modules/projects/project.repository.js', () => ({
  default: { findById: jest.fn(), updateStatus: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: { deleteManyByDomain: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/skills/skill.repository.js', () => ({
  default: { deleteManyByDomain: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/mcp/mcp.repository.js', () => ({
  default: { deleteManyByDomain: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/providers/provider.repository.js', () => ({
  default: { deleteManyByDomain: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/mcp/mcp-user-connection.repository.js', () => ({
  default: { deleteManyByDomain: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/knowledge/knowledge.service.js', () => ({
  default: { deleteAllByDomain: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: { deleteAllBySubject: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: { cleanupThreads: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/files/file.repository.js', () => ({
  default: { findByDomain: jest.fn(), deleteMany: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/files/file.service.js', () => ({
  default: {},
  developerUploadDir: '/tmp/developer-uploads-test',
}));
jest.unstable_mockModule('../src/modules/externalUsers/externalUser.repository.js', () => ({
  default: { deleteAllByProject: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/projects/projectMembership.repository.js', () => ({
  default: { deleteAllByProject: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/projects/projectCredential.repository.js', () => ({
  default: { deleteAllByProject: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/audit/auditLog.service.js', () => ({
  default: { record: jest.fn() },
}));

const projectRepository = (await import('../src/modules/projects/project.repository.js')).default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const skillRepository = (await import('../src/modules/skills/skill.repository.js')).default;
const mcpRepository = (await import('../src/modules/mcp/mcp.repository.js')).default;
const providerRepository = (await import('../src/modules/providers/provider.repository.js'))
  .default;
const mcpUserConnectionRepository = (
  await import('../src/modules/mcp/mcp-user-connection.repository.js')
).default;
const knowledgeService = (await import('../src/modules/knowledge/knowledge.service.js')).default;
const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const checkpointService = (await import('../src/modules/threads/checkpoint.service.js')).default;
const fileRepository = (await import('../src/modules/files/file.repository.js')).default;
const externalUserRepository = (
  await import('../src/modules/externalUsers/externalUser.repository.js')
).default;
const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
const projectCredentialRepository = (
  await import('../src/modules/projects/projectCredential.repository.js')
).default;
const auditLogService = (await import('../src/modules/audit/auditLog.service.js')).default;

const { enqueueProjectCleanup } = await import('../src/modules/jobs/cleanupDeletedProject.job.js');

/**
 * Developer Platform (blueprint Phase 10, PR-53, AD-08 §28/§29). The
 * highest-risk piece of this PR: the actual Domain-scoped cascade body.
 * `agenda.define` is mocked to capture the registered handler so it can be
 * invoked directly with a fake `job` object, without needing a real Agenda/
 * Mongo connection.
 */
describe('cleanupDeletedProject job (blueprint Phase 10, PR-53)', () => {
  let handler;

  beforeAll(() => {
    expect(mockDefine).toHaveBeenCalledWith('cleanup-deleted-project', expect.any(Function));
    handler = mockDefine.mock.calls[0][1];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeJob(projectId = 'project_1') {
    return { attrs: { data: { projectId } } };
  }

  test('skips entirely when the Project no longer exists', async () => {
    projectRepository.findById.mockResolvedValue(null);

    await handler(makeJob());

    expect(agentRepository.deleteManyByDomain).not.toHaveBeenCalled();
    expect(projectRepository.updateStatus).not.toHaveBeenCalled();
  });

  test('skips entirely when the Project is not DELETING — never trusts the trigger alone', async () => {
    projectRepository.findById.mockResolvedValue({ _id: 'project_1', status: 'ACTIVE' });

    await handler(makeJob());

    expect(agentRepository.deleteManyByDomain).not.toHaveBeenCalled();
    expect(projectRepository.updateStatus).not.toHaveBeenCalled();
  });

  test('runs the full cascade in order and lands on DELETED, never hard-deleting the Project', async () => {
    projectRepository.findById.mockResolvedValue({ _id: 'project_1', status: 'DELETING' });
    knowledgeService.deleteAllByDomain.mockResolvedValue(2);
    threadRepository.deleteAllBySubject.mockResolvedValue({
      deletedCount: 3,
      threadIds: ['t1', 't2', 't3'],
    });
    fileRepository.findByDomain.mockResolvedValue([
      { storageKey: 'uuid-1.txt' },
      { storageKey: 'uuid-2.txt' },
    ]);
    fileRepository.deleteMany.mockResolvedValue({ deletedCount: 2 });
    agentRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 1 });
    skillRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 1 });
    mcpRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 1 });
    providerRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 1 });
    mcpUserConnectionRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 1 });
    externalUserRepository.deleteAllByProject.mockResolvedValue({ deletedCount: 2 });
    projectMembershipRepository.deleteAllByProject.mockResolvedValue({ deletedCount: 1 });
    projectCredentialRepository.deleteAllByProject.mockResolvedValue({ deletedCount: 1 });
    projectRepository.updateStatus.mockResolvedValue({ _id: 'project_1', status: 'DELETED' });

    await handler(makeJob('project_1'));

    expect(knowledgeService.deleteAllByDomain).toHaveBeenCalledWith('project_1');
    expect(threadRepository.deleteAllBySubject).toHaveBeenCalledWith({ domain: 'project_1' });
    expect(checkpointService.cleanupThreads).toHaveBeenCalledWith(['t1', 't2', 't3']);
    expect(fileRepository.findByDomain).toHaveBeenCalledWith('project_1');
    expect(mockUnlink).toHaveBeenCalledTimes(2);
    expect(fileRepository.deleteMany).toHaveBeenCalledWith({ domain: 'project_1' });
    expect(agentRepository.deleteManyByDomain).toHaveBeenCalledWith('project_1');
    expect(skillRepository.deleteManyByDomain).toHaveBeenCalledWith('project_1');
    expect(mcpRepository.deleteManyByDomain).toHaveBeenCalledWith('project_1');
    expect(providerRepository.deleteManyByDomain).toHaveBeenCalledWith('project_1');
    expect(mcpUserConnectionRepository.deleteManyByDomain).toHaveBeenCalledWith('project_1');
    expect(externalUserRepository.deleteAllByProject).toHaveBeenCalledWith('project_1');
    expect(projectMembershipRepository.deleteAllByProject).toHaveBeenCalledWith('project_1');
    expect(projectCredentialRepository.deleteAllByProject).toHaveBeenCalledWith('project_1');
    expect(projectRepository.updateStatus).toHaveBeenCalledWith('project_1', 'DELETED', {});
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'project.deletion_completed',
        targetDomain: 'project_1',
      })
    );
  });

  test('a single failed file unlink never aborts the rest of the cascade', async () => {
    projectRepository.findById.mockResolvedValue({ _id: 'project_1', status: 'DELETING' });
    knowledgeService.deleteAllByDomain.mockResolvedValue(0);
    threadRepository.deleteAllBySubject.mockResolvedValue({ deletedCount: 0, threadIds: [] });
    fileRepository.findByDomain.mockResolvedValue([{ storageKey: 'missing-on-disk.txt' }]);
    fileRepository.deleteMany.mockResolvedValue({ deletedCount: 1 });
    mockUnlink.mockRejectedValueOnce(new Error('ENOENT'));
    agentRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    skillRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    mcpRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    providerRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    mcpUserConnectionRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    externalUserRepository.deleteAllByProject.mockResolvedValue({ deletedCount: 0 });
    projectMembershipRepository.deleteAllByProject.mockResolvedValue({ deletedCount: 0 });
    projectCredentialRepository.deleteAllByProject.mockResolvedValue({ deletedCount: 0 });
    projectRepository.updateStatus.mockResolvedValue({ _id: 'project_1', status: 'DELETED' });

    await handler(makeJob('project_1'));

    expect(fileRepository.deleteMany).toHaveBeenCalledWith({ domain: 'project_1' });
    expect(projectRepository.updateStatus).toHaveBeenCalledWith('project_1', 'DELETED', {});
  });

  test('skips checkpoint cleanup entirely when the Domain has no threads', async () => {
    projectRepository.findById.mockResolvedValue({ _id: 'project_1', status: 'DELETING' });
    knowledgeService.deleteAllByDomain.mockResolvedValue(0);
    threadRepository.deleteAllBySubject.mockResolvedValue({ deletedCount: 0, threadIds: [] });
    fileRepository.findByDomain.mockResolvedValue([]);
    fileRepository.deleteMany.mockResolvedValue({ deletedCount: 0 });
    agentRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    skillRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    mcpRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    providerRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    mcpUserConnectionRepository.deleteManyByDomain.mockResolvedValue({ deletedCount: 0 });
    externalUserRepository.deleteAllByProject.mockResolvedValue({ deletedCount: 0 });
    projectMembershipRepository.deleteAllByProject.mockResolvedValue({ deletedCount: 0 });
    projectCredentialRepository.deleteAllByProject.mockResolvedValue({ deletedCount: 0 });
    projectRepository.updateStatus.mockResolvedValue({ _id: 'project_1', status: 'DELETED' });

    await handler(makeJob('project_1'));

    expect(checkpointService.cleanupThreads).not.toHaveBeenCalled();
  });

  describe('enqueueProjectCleanup', () => {
    test('enqueues an immediate ("now") Agenda job with a stringified projectId', async () => {
      mockNow.mockResolvedValue({});

      await enqueueProjectCleanup({ toString: () => 'project_1' });

      expect(mockNow).toHaveBeenCalledWith('cleanup-deleted-project', { projectId: 'project_1' });
    });
  });
});
