import crypto from 'crypto';
import { firmRepository, firmProjectRepository, clientProjectRepository } from './firm.repository.js';
import { computeProgress, CLIENT_PROJECT_STATUS, DELIVERABLE_STATUS } from './clientProject.model.js';
import { FIRM_STATUS } from './firm.model.js';
import { FIRM_PROJECT_STATUS } from './firmProject.model.js';
import threadRepository from '../threads/thread.repository.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import BaseError from '../../utils/errors/BaseError.js';

function isClient(project, userId) {
  return String(project.clientId?._id || project.clientId) === String(userId);
}
function isOwner(project, userId) {
  return String(project.ownerId?._id || project.ownerId) === String(userId);
}

class ClientProjectService {
  /**
   * Shelf door: the client picked a published project. Stamp the SOW from
   * the template, open a thread with the lead employee, and record the start.
   */
  async startProject(clientId, firmSlug, projectSlug, inputs = {}) {
    const firm = await firmRepository.findBySlug(firmSlug);
    if (!firm || firm.status !== FIRM_STATUS.PUBLISHED) throw new NotFoundError('Firm not found');
    const template = await firmProjectRepository.findByFirmAndSlug(firm._id, projectSlug);
    if (!template || template.status !== FIRM_PROJECT_STATUS.PUBLISHED) {
      throw new NotFoundError('Project not found');
    }
    if (!template.leadAgentId) {
      throw new BaseError('This project has no lead employee yet', 400, 'PROJECT_NOT_READY');
    }
    const missing = (template.inputs || [])
      .filter((i) => i.required && !String(inputs[i.key] || '').trim())
      .map((i) => i.label);
    if (missing.length) {
      const err = new BaseError('Some required details are missing', 400, 'MISSING_INPUTS');
      err.details = missing;
      throw err;
    }

    const now = new Date();
    const dueAt = new Date(now.getTime() + (template.durationDays || 14) * 86400000);
    const project = await clientProjectRepository.create({
      firmId: firm._id,
      templateId: template._id,
      clientId,
      ownerId: firm.ownerId,
      title: template.title,
      outcome: template.outcome,
      sow: {
        deliverables: (template.deliverables || []).map((d) => ({
          name: d.name,
          acceptanceCriteria: d.acceptanceCriteria,
          status: DELIVERABLE_STATUS.PENDING,
        })),
        durationDays: template.durationDays,
        checkpoints: template.checkpoints || [],
        price: template.price,
      },
      inputs,
      leadAgentId: template.leadAgentId,
      startedAt: now,
      dueAt,
      activity: [
        {
          type: 'started',
          message: `Project started. Due ${dueAt.toDateString()}.`,
          by: 'system',
          at: now,
        },
      ],
    });

    const thread = await threadRepository.create({
      agentId: template.leadAgentId,
      userId: clientId,
      subjectType: 'PersonaUser',
      threadId: crypto.randomUUID(),
      title: template.title,
      projectId: project._id,
      firmId: firm._id,
    });
    project.threadId = thread._id;
    await clientProjectRepository.save(project);
    await firmRepository.incrementStat(firm._id, 'projectsStarted');

    return { project: await clientProjectRepository.findByIdPopulated(project._id), thread };
  }

  async listMine(clientId) {
    return await clientProjectRepository.findByClient(clientId);
  }

  /** Firms this user has a relationship with: any project or any thread. */
  async listMyFirms(userId) {
    const projects = await clientProjectRepository.findByClient(userId);
    const byFirm = new Map();
    for (const p of projects) {
      const f = p.firmId;
      if (!f) continue;
      const key = String(f._id);
      const row = byFirm.get(key) || { firm: f, projectCount: 0, lastActiveAt: null };
      row.projectCount += 1;
      if (!row.lastActiveAt || p.lastActivityAt > row.lastActiveAt) row.lastActiveAt = p.lastActivityAt;
      byFirm.set(key, row);
    }
    const threads = await threadRepository.findBySubject({ userId, firmId: { $ne: null } }, { page: 1, limit: 200 });
    const firmIdsFromThreads = [...new Set(threads.map((t) => String(t.firmId)))].filter(
      (id) => !byFirm.has(id)
    );
    if (firmIdsFromThreads.length) {
      const firms = await firmRepository.findManyByIds(firmIdsFromThreads);
      for (const f of firms) {
        const last = threads.find((t) => String(t.firmId) === String(f._id))?.lastMessageAt || null;
        byFirm.set(String(f._id), { firm: f, projectCount: 0, lastActiveAt: last });
      }
    }
    return [...byFirm.values()].sort(
      (a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0)
    );
  }

  async getForUser(projectId, userId) {
    const project = await clientProjectRepository.findByIdPopulated(projectId);
    if (!project || (!isClient(project, userId) && !isOwner(project, userId))) {
      throw new NotFoundError('Project not found');
    }
    return project;
  }

  /** Access check used by the AG-UI middleware. Returns the raw doc. */
  async getForRuntime(projectId, userId) {
    const project = await clientProjectRepository.findById(projectId);
    if (!project || (!isClient(project, userId) && !isOwner(project, userId))) return null;
    return project;
  }

  async respondToInbox(projectId, userId, itemId, response) {
    const project = await clientProjectRepository.findById(projectId);
    if (!project || !isClient(project, userId)) throw new NotFoundError('Project not found');
    const item = project.inbox.id(itemId);
    if (!item) throw new NotFoundError('Inbox item not found');
    item.status = 'done';
    item.response = response;
    item.respondedAt = new Date();
    project.activity.push({ type: 'response', message: `Client answered: "${item.ask}"`, by: 'client' });
    if (project.status === CLIENT_PROJECT_STATUS.BLOCKED && !project.inbox.some((i) => i.status === 'open')) {
      project.status = CLIENT_PROJECT_STATUS.ACTIVE;
    }
    project.lastActivityAt = new Date();
    await clientProjectRepository.save(project);
    return await clientProjectRepository.findByIdPopulated(projectId);
  }

  async acceptDeliverable(projectId, userId, index) {
    const project = await clientProjectRepository.findById(projectId);
    if (!project || !isClient(project, userId)) throw new NotFoundError('Project not found');
    const d = project.sow.deliverables[index];
    if (!d) throw new NotFoundError('Deliverable not found');
    if (d.status !== DELIVERABLE_STATUS.DELIVERED) {
      throw new BaseError('Only delivered work can be accepted', 400, 'NOT_DELIVERED');
    }
    d.status = DELIVERABLE_STATUS.ACCEPTED;
    d.updatedAt = new Date();
    project.activity.push({ type: 'accepted', message: `Accepted: ${d.name}`, by: 'client' });
    await this._recompute(project);
    return await clientProjectRepository.findByIdPopulated(projectId);
  }

  // ── Agent-side mutations (called by firm.tools.js) ───────────────────────
  async agentGetBrief(projectId) {
    const project = await clientProjectRepository.findByIdPopulated(projectId);
    if (!project) return null;
    return this.toBrief(project);
  }

  toBrief(project) {
    const inputs = project.inputs instanceof Map ? Object.fromEntries(project.inputs) : project.inputs || {};
    return {
      id: String(project._id),
      title: project.title,
      outcome: project.outcome,
      status: project.status,
      progress: project.progress,
      client: project.clientId?.name || 'the client',
      startedAt: project.startedAt,
      dueAt: project.dueAt,
      deliverables: project.sow.deliverables.map((d, i) => ({
        index: i,
        name: d.name,
        acceptanceCriteria: d.acceptanceCriteria,
        status: d.status,
        note: d.note,
        artifactPath: d.artifactPath,
      })),
      checkpoints: project.sow.checkpoints,
      inputs,
      openRequests: project.inbox
        .filter((i) => i.status === 'open')
        .map((i) => ({ id: String(i._id), ask: i.ask, dueBy: i.dueBy })),
      answeredRequests: project.inbox
        .filter((i) => i.status === 'done')
        .slice(-5)
        .map((i) => ({ ask: i.ask, response: i.response })),
      recentActivity: project.activity.slice(-6).map((a) => `${a.by}: ${a.message}`),
    };
  }

  async agentUpdateDeliverable(projectId, { index, status, note, artifactPath }) {
    const project = await clientProjectRepository.findById(projectId);
    if (!project) throw new NotFoundError('Project not found');
    const d = project.sow.deliverables[index];
    if (!d) throw new NotFoundError(`No deliverable at index ${index}`);
    if (d.status === DELIVERABLE_STATUS.ACCEPTED) {
      return { ok: false, message: 'Already accepted by the client; cannot change.' };
    }
    if (![DELIVERABLE_STATUS.IN_PROGRESS, DELIVERABLE_STATUS.DELIVERED].includes(status)) {
      return { ok: false, message: 'status must be in_progress or delivered' };
    }
    d.status = status;
    if (note) d.note = note;
    if (artifactPath) d.artifactPath = artifactPath;
    d.updatedAt = new Date();
    project.activity.push({
      type: 'deliverable',
      message: `${status === 'delivered' ? 'Delivered' : 'Started'}: ${d.name}${note ? ` — ${note}` : ''}`,
      by: 'agent',
    });
    await this._recompute(project);
    return { ok: true, progress: project.progress, deliverable: d };
  }

  async agentRequestFromClient(projectId, { ask, dueInDays }) {
    const project = await clientProjectRepository.findById(projectId);
    if (!project) throw new NotFoundError('Project not found');
    const dueBy = dueInDays ? new Date(Date.now() + dueInDays * 86400000) : null;
    project.inbox.push({ ask, dueBy });
    project.activity.push({ type: 'request', message: `Needs from client: ${ask}`, by: 'agent' });
    project.status = CLIENT_PROJECT_STATUS.BLOCKED;
    project.lastActivityAt = new Date();
    await clientProjectRepository.save(project);
    const item = project.inbox[project.inbox.length - 1];
    return { ok: true, requestId: String(item._id) };
  }

  async agentLogProgress(projectId, message) {
    const project = await clientProjectRepository.findById(projectId);
    if (!project) throw new NotFoundError('Project not found');
    project.activity.push({ type: 'note', message, by: 'agent' });
    project.lastActivityAt = new Date();
    await clientProjectRepository.save(project);
    return { ok: true };
  }

  async _recompute(project) {
    project.progress = computeProgress(project.sow.deliverables);
    const allAccepted =
      project.sow.deliverables.length > 0 &&
      project.sow.deliverables.every((d) => d.status === DELIVERABLE_STATUS.ACCEPTED);
    if (allAccepted && project.status !== CLIENT_PROJECT_STATUS.DONE) {
      project.status = CLIENT_PROJECT_STATUS.DONE;
      project.completedAt = new Date();
      project.activity.push({ type: 'done', message: 'All deliverables accepted. Project complete.', by: 'system' });
      await firmRepository.incrementStat(project.firmId, 'projectsCompleted');
    } else if (!allAccepted && project.status === CLIENT_PROJECT_STATUS.BLOCKED) {
      if (!project.inbox.some((i) => i.status === 'open')) project.status = CLIENT_PROJECT_STATUS.ACTIVE;
    }
    project.lastActivityAt = new Date();
    await clientProjectRepository.save(project);
  }
}

export default new ClientProjectService();
