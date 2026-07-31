import path from 'path';
import fs from 'fs/promises';
import agenda from './agenda.js';
import { loggerService } from '../../utils/index.js';
import projectRepository from '../projects/project.repository.js';
import { PROJECT_STATUS } from '../projects/project.model.js';
import agentRepository from '../agents/agent.repository.js';
import skillRepository from '../skills/skill.repository.js';
import mcpRepository from '../mcp/mcp.repository.js';
import providerRepository from '../providers/provider.repository.js';
import mcpUserConnectionRepository from '../mcp/mcp-user-connection.repository.js';
import knowledgeService from '../knowledge/knowledge.service.js';
import threadRepository from '../threads/thread.repository.js';
import checkpointService from '../threads/checkpoint.service.js';
import fileRepository from '../files/file.repository.js';
import { developerUploadDir } from '../files/file.service.js';
import externalUserRepository from '../externalUsers/externalUser.repository.js';
import projectMembershipRepository from '../projects/projectMembership.repository.js';
import projectCredentialRepository from '../projects/projectCredential.repository.js';
import auditLogService from '../audit/auditLog.service.js';

const logger = loggerService.getLogger();

export const CLEANUP_DELETED_PROJECT_JOB = 'cleanup-deleted-project';

/**
 * Developer Platform (blueprint Phase 10, PR-53, AD-08 §28/§29). The
 * Agenda-executed body of a Project's async, Domain-scoped deletion
 * cascade — reuses every existing per-resource-type deletion primitive
 * (Qdrant collection deletion, checkpoint cleanup, disk file unlink)
 * rather than duplicating that logic, and the three Project-scoped
 * `deleteAllByProject` methods (ExternalUser/ProjectMembership/
 * ProjectCredential) that were already defined but never wired to
 * anything until this job.
 *
 * The Project document is never hard-deleted (`projectRepository.delete`)
 * — it persists as an audit tombstone in the terminal `DELETED` status
 * (AD-08 §25/§28).
 */
agenda.define(CLEANUP_DELETED_PROJECT_JOB, async (job) => {
  const { projectId } = job.attrs.data;
  const domain = String(projectId);

  const project = await projectRepository.findById(projectId);
  if (!project) {
    logger.warn(`[CleanupJob] Project ${projectId} no longer exists, skipping`);
    return;
  }
  // Defensive re-check — never trust the cron trigger alone (blueprint
  // §28: "re-verify status === DELETING... before executing").
  if (project.status !== PROJECT_STATUS.DELETING) {
    logger.warn(
      `[CleanupJob] Project ${projectId} is not DELETING (status=${project.status}), skipping`
    );
    return;
  }

  logger.info(`[CleanupJob] Starting Domain-scoped cleanup for Project ${projectId}`);

  const kbCount = await knowledgeService.deleteAllByDomain(domain);
  logger.info(`[CleanupJob] Deleted ${kbCount} Knowledge Base(s)`);

  const { threadIds, deletedCount: threadCount } = await threadRepository.deleteAllBySubject({
    domain,
  });
  if (threadIds?.length) {
    await checkpointService.cleanupThreads(threadIds);
  }
  logger.info(
    `[CleanupJob] Deleted ${threadCount || 0} thread(s), ${threadIds?.length || 0} checkpoint(s)`
  );

  const files = await fileRepository.findByDomain(domain);
  for (const file of files) {
    const storagePath = path.join(developerUploadDir, file.storageKey);
    await fs.unlink(storagePath).catch(() => {});
  }
  await fileRepository.deleteMany({ domain });
  logger.info(`[CleanupJob] Deleted ${files.length} file(s)`);

  await Promise.all([
    agentRepository.deleteManyByDomain(domain),
    skillRepository.deleteManyByDomain(domain),
    mcpRepository.deleteManyByDomain(domain),
    providerRepository.deleteManyByDomain(domain),
    mcpUserConnectionRepository.deleteManyByDomain(domain),
  ]);

  await Promise.all([
    externalUserRepository.deleteAllByProject(projectId),
    projectMembershipRepository.deleteAllByProject(projectId),
    projectCredentialRepository.deleteAllByProject(projectId),
  ]);

  await projectRepository.updateStatus(projectId, PROJECT_STATUS.DELETED, {});

  await auditLogService.record({
    eventType: 'project.deletion_completed',
    actorContextType: 'System',
    actorIdentity: 'cleanup-job',
    targetDomain: projectId,
  });

  logger.info(`[CleanupJob] Completed Domain-scoped cleanup for Project ${projectId}`);
});

export async function enqueueProjectCleanup(projectId) {
  await agenda.now(CLEANUP_DELETED_PROJECT_JOB, { projectId: String(projectId) });
}
