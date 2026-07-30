import projectRepository from './project.repository.js';
import projectMembershipRepository from './projectMembership.repository.js';
import { MEMBERSHIP_ROLE } from './projectMembership.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';

class ProjectService {
  /**
   * Creates a new Project and grants its creator an initial Admin
   * membership (AD-08 §6). The creator is recorded on the Project as
   * audit-only metadata (`createdBy`) — it is NOT a permanent role; the
   * initial Admin membership this method also grants is an ordinary,
   * later-revocable membership row like any other (AD-08 §1/§8), not a
   * special Owner concept.
   *
   * `personaContext` is a PersonaPrincipalContext-shaped object (see
   * personaPrincipalContext.js) — any authenticated Persona User may
   * create a Project (AD-08 §6); no additional authority is required.
   *
   * KNOWN LIMITATION, now wired to `POST /api/v1/projects` (blueprint §42):
   * these are two sequential writes, not a single Mongo transaction (this
   * codebase has no transaction infrastructure configured). If the
   * membership write fails after the Project write succeeds, this method
   * makes a best-effort compensating delete of the just-created Project
   * before rethrowing — not a true atomic rollback (the delete itself
   * could fail too, e.g. on a connection drop), but it closes the common
   * case instead of leaving an admin-less Project as the default outcome
   * of any membership-write failure.
   */
  async createProject(personaContext, { name, description, slug } = {}) {
    if (!personaContext?.personaUserId) {
      throw new Error('createProject: a PersonaPrincipalContext with personaUserId is required');
    }

    const project = await projectRepository.create({
      name,
      description,
      slug,
      createdBy: personaContext.personaUserId,
    });

    try {
      await projectMembershipRepository.create({
        project: project._id,
        personaUserId: personaContext.personaUserId,
        role: MEMBERSHIP_ROLE.ADMIN,
      });
    } catch (membershipError) {
      try {
        await projectRepository.delete(project._id);
      } catch (rollbackError) {
        // Best-effort only — surface the original failure either way.
      }
      throw membershipError;
    }

    return project;
  }

  async getProjectById(projectId) {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found', 'Project');
    }
    return project;
  }

  async updateMetadata(projectId, updateData) {
    const project = await projectRepository.updateMetadata(projectId, updateData);
    if (!project) {
      throw new NotFoundError('Project not found', 'Project');
    }
    return project;
  }

  /**
   * Lists every Project the given Persona User holds a membership in
   * (any role — v1 only has Admin, but this deliberately doesn't hardcode
   * that assumption). Used for "my Projects" — there is no concept of
   * listing every Project platform-wide via this method.
   */
  async listProjectsForUser(personaUserId) {
    const memberships = await projectMembershipRepository.findByUser(personaUserId);
    if (memberships.length === 0) return [];

    const projectIds = memberships.map((m) => m.project);
    return await projectRepository.findByIds(projectIds);
  }
}

export default new ProjectService();
