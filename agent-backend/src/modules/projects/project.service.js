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
   * KNOWN LIMITATION (flagged, not silently ignored — see the master
   * implementation blueprint §42): these are two sequential writes, not a
   * single Mongo transaction (this codebase has no transaction
   * infrastructure configured). If the membership write fails after the
   * Project write succeeds, a Project could momentarily exist with zero
   * memberships. This service is not reachable from any route yet;
   * closing this gap is a required hardening step before it is wired to a
   * real endpoint.
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

    await projectMembershipRepository.create({
      project: project._id,
      personaUserId: personaContext.personaUserId,
      role: MEMBERSHIP_ROLE.ADMIN,
    });

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
}

export default new ProjectService();
