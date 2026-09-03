import { firmRepository, firmProjectRepository, clientProjectRepository } from './firm.repository.js';
import { FIRM_STATUS } from './firm.model.js';
import { FIRM_PROJECT_STATUS } from './firmProject.model.js';
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import BaseError from '../../utils/errors/BaseError.js';
import { slugify } from './slugify.js';
export { slugify };

async function uniqueSlug(base, exists) {
  let slug = base;
  let n = 2;
  while (await exists(slug)) slug = `${base}-${n++}`;
  return slug;
}

const PUBLIC_PROJECT_FIELDS =
  '_id firmId slug title outcome summary description whoFor deliverables durationDays price inputs checkpoints leadAgentId employeeIds status order createdAt updatedAt';

function publicProject(p) {
  const obj = p.toObject ? p.toObject() : { ...p };
  delete obj.instructions;
  delete obj.skillIds;
  delete obj.ownerId;
  return obj;
}

function publicEmployee(a) {
  return {
    _id: a._id,
    name: a.name,
    slug: a.slug,
    avatarUrl: a.avatarUrl || a.avatar,
    description: a.description,
    role: a.role || {},
  };
}

class FirmService {
  // ── Owner ────────────────────────────────────────────────────────────────
  async getMyFirm(ownerId) {
    const firm = await firmRepository.findByOwner(ownerId);
    if (!firm) throw new NotFoundError('You have not created a firm yet');
    return firm;
  }

  async createFirm(ownerId, data) {
    const existing = await firmRepository.findByOwner(ownerId);
    if (existing) throw new BaseError('You already have a firm', 409, 'FIRM_EXISTS');
    const slug = await uniqueSlug(slugify(data.name), (s) => firmRepository.slugExists(s));
    return await firmRepository.create({ ...data, ownerId, slug });
  }

  async updateMyFirm(ownerId, data) {
    const firm = await this.getMyFirm(ownerId);
    if (data.frontDeskAgentId) {
      const agent = await agentRepository.findById(data.frontDeskAgentId);
      if (!agent || String(agent.ownerId) !== String(ownerId)) {
        throw new BaseError('Front desk agent must be one of your agents', 400, 'INVALID_AGENT');
      }
      if (String(agent.firmId) !== String(firm._id)) {
        await agentRepository.update(agent._id, {
          firmId: firm._id,
          'role.facing': 'client',
          ...(agent.role?.title ? {} : { 'role.title': 'Front desk' }),
        });
        agentFactory.invalidate(agent._id);
      }
    }
    const patch = { ...data };
    delete patch.ownerId;
    delete patch.slug;
    delete patch.status;
    return await firmRepository.update(firm._id, patch);
  }

  async publishRequirements(firm) {
    const missing = [];
    if (!firm.name) missing.push('A firm name');
    if (!firm.tagline) missing.push('A tagline');
    if (!firm.frontDeskAgentId) missing.push('A front desk employee');
    const published = await firmProjectRepository.findByFirm(firm._id, {
      status: FIRM_PROJECT_STATUS.PUBLISHED,
    });
    if (published.length === 0) missing.push('At least one published project');
    for (const p of published) {
      if (!p.leadAgentId) missing.push(`A lead employee on "${p.title}"`);
    }
    return missing;
  }

  async publishMyFirm(ownerId) {
    const firm = await this.getMyFirm(ownerId);
    const missing = await this.publishRequirements(firm);
    if (missing.length) {
      const err = new BaseError('Firm is not ready to publish', 400, 'FIRM_NOT_READY');
      err.details = missing;
      throw err;
    }
    return await firmRepository.update(firm._id, {
      status: FIRM_STATUS.PUBLISHED,
      publishedAt: firm.publishedAt || new Date(),
    });
  }

  async unpublishMyFirm(ownerId) {
    const firm = await this.getMyFirm(ownerId);
    return await firmRepository.update(firm._id, { status: FIRM_STATUS.DRAFT });
  }

  // ── Templates ────────────────────────────────────────────────────────────
  async listMyProjects(ownerId) {
    const firm = await this.getMyFirm(ownerId);
    return await firmProjectRepository.findByFirm(firm._id);
  }

  async createProject(ownerId, data) {
    const firm = await this.getMyFirm(ownerId);
    await this._assertAgentsBelongToOwner(ownerId, data);
    const slug = await uniqueSlug(slugify(data.title), (s) =>
      firmProjectRepository.slugExists(firm._id, s)
    );
    return await firmProjectRepository.create({ ...data, firmId: firm._id, ownerId, slug });
  }

  async updateProject(ownerId, projectId, data) {
    const firm = await this.getMyFirm(ownerId);
    await this._assertAgentsBelongToOwner(ownerId, data);
    const patch = { ...data };
    delete patch.firmId;
    delete patch.ownerId;
    delete patch.slug;
    const project = await firmProjectRepository.update(projectId, firm._id, patch);
    if (!project) throw new NotFoundError('Project not found');
    return project;
  }

  async deleteProject(ownerId, projectId) {
    const firm = await this.getMyFirm(ownerId);
    const removed = await firmProjectRepository.delete(projectId, firm._id);
    if (!removed) throw new NotFoundError('Project not found');
  }

  async _assertAgentsBelongToOwner(ownerId, data) {
    const ids = [data.leadAgentId, ...(data.employeeIds || [])].filter(Boolean);
    for (const id of ids) {
      const agent = await agentRepository.findById(id);
      if (!agent || String(agent.ownerId) !== String(ownerId)) {
        throw new BaseError('Employees must be your own agents', 400, 'INVALID_AGENT');
      }
    }
  }

  // ── Team ─────────────────────────────────────────────────────────────────
  async listMyTeam(ownerId) {
    const firm = await firmRepository.findByOwner(ownerId);
    const agents = await agentRepository.search({ ownerId, isActive: true }, { page: 1, limit: 100 });
    return agents.map((a) => ({
      _id: a._id,
      name: a.name,
      slug: a.slug,
      avatarUrl: a.avatarUrl || a.avatar,
      description: a.description,
      visibility: a.visibility,
      role: a.role || {},
      isMember: Boolean(firm && a.firmId && String(a.firmId) === String(firm._id)),
      isFrontDesk: Boolean(firm && firm.frontDeskAgentId && String(firm.frontDeskAgentId) === String(a._id)),
      skillCount: (a.skills || []).length,
    }));
  }

  async updateTeamMember(ownerId, agentId, { member, role }) {
    const firm = await this.getMyFirm(ownerId);
    const agent = await agentRepository.findById(agentId);
    if (!agent || String(agent.ownerId) !== String(ownerId)) throw new NotFoundError('Agent not found');
    const patch = {};
    if (member === true) patch.firmId = firm._id;
    if (member === false) {
      patch.firmId = null;
      if (String(firm.frontDeskAgentId) === String(agentId)) {
        await firmRepository.update(firm._id, { frontDeskAgentId: null });
      }
    }
    if (role) {
      for (const [k, v] of Object.entries(role)) if (v !== undefined) patch[`role.${k}`] = v;
    }
    const updated = await agentRepository.update(agentId, patch);
    // Roster is compiled into every employee's subagent list — rebuild them all.
    const employees = await agentRepository.search({ firmId: firm._id }, { page: 1, limit: 100 });
    for (const e of employees) agentFactory.invalidate(e._id);
    agentFactory.invalidate(agentId);
    return updated;
  }

  async listMyClients(ownerId) {
    const firm = await this.getMyFirm(ownerId);
    return await clientProjectRepository.findByFirm(firm._id);
  }

  // ── Public ───────────────────────────────────────────────────────────────
  async listPublished({ search, category, page = 1, limit = 30 } = {}) {
    const filter = { status: FIRM_STATUS.PUBLISHED };
    if (category && category !== 'all') filter.category = category;
    if (search) {
      const rx = { $regex: search, $options: 'i' };
      filter.$or = [
        { name: rx },
        { tagline: rx },
        { bio: rx },
        { expertise: rx },
        { 'mandate.takes': rx },
        { 'mandate.clientProfile': rx },
      ];
    }
    const [firms, total] = await Promise.all([
      firmRepository.search(filter, { page, limit }),
      firmRepository.count(filter),
    ]);
    const counts = await firmProjectRepository.countByFirms(
      firms.map((f) => f._id),
      { status: FIRM_PROJECT_STATUS.PUBLISHED }
    );
    return {
      firms: firms.map((f) => ({ ...f.toObject(), projectCount: counts[String(f._id)] || 0 })),
      total,
      page,
      limit,
    };
  }

  async getStorefront(slug, viewerId = null) {
    const firm = await firmRepository.findBySlug(slug);
    if (!firm) throw new NotFoundError('Firm not found');
    const isOwner = viewerId && String(firm.ownerId) === String(viewerId);
    if (firm.status !== FIRM_STATUS.PUBLISHED && !isOwner) throw new NotFoundError('Firm not found');
    const projects = await firmProjectRepository.findByFirm(
      firm._id,
      isOwner ? {} : { status: FIRM_PROJECT_STATUS.PUBLISHED }
    );
    const employees = await agentRepository.search(
      { firmId: firm._id, isActive: true },
      { page: 1, limit: 50 }
    );
    return {
      firm: firm.toObject(),
      projects: projects.map(publicProject),
      team: employees.map(publicEmployee),
      isOwner: Boolean(isOwner),
    };
  }

  async getPublicProject(slug, projectSlug, viewerId = null) {
    const { firm, team } = await this.getStorefront(slug, viewerId);
    const project = await firmProjectRepository.findByFirmAndSlug(firm._id, projectSlug);
    const isOwner = viewerId && String(firm.ownerId) === String(viewerId);
    if (!project || (project.status !== FIRM_PROJECT_STATUS.PUBLISHED && !isOwner)) {
      throw new NotFoundError('Project not found');
    }
    const lead = team.find((t) => String(t._id) === String(project.leadAgentId)) || null;
    const employees = team.filter((t) =>
      (project.employeeIds || []).some((id) => String(id) === String(t._id))
    );
    return { firm, project: publicProject(project), lead, employees };
  }
}

export default new FirmService();
export { PUBLIC_PROJECT_FIELDS, publicProject };
