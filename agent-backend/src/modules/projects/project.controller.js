import projectService from './project.service.js';
import projectMembershipService from './projectMembership.service.js';
import projectCredentialService from './projectCredential.service.js';
import userRepository from '../users/user.repository.js';
import { createPersonaPrincipalContext } from '../auth/personaPrincipalContext.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';

class ProjectController {
  async create(req, res, next) {
    try {
      const personaContext = createPersonaPrincipalContext(req.user);
      const project = await projectService.createProject(personaContext, req.body);

      res.status(201).json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async listMine(req, res, next) {
    try {
      const personaUserId = req.user._id ?? req.user.id;
      const projects = await projectService.listProjectsForUser(personaUserId);

      res.json({ success: true, data: projects });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const project = await projectService.getProjectById(req.projectAdminContext.domain);

      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async updateMetadata(req, res, next) {
    try {
      const project = await projectService.updateMetadata(
        req.projectAdminContext.domain,
        req.body,
        req.projectAdminContext.personaUserId
      );

      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async suspend(req, res, next) {
    try {
      const project = await projectService.suspendProject(
        req.projectAdminContext.personaUserId,
        req.projectAdminContext.domain
      );

      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async reactivate(req, res, next) {
    try {
      const project = await projectService.reactivateProject(
        req.projectAdminContext.domain,
        req.projectAdminContext.personaUserId
      );

      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async requestDeletion(req, res, next) {
    try {
      const project = await projectService.requestDeletion(
        req.projectAdminContext.domain,
        req.projectAdminContext.personaUserId
      );

      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async cancelDeletion(req, res, next) {
    try {
      const project = await projectService.cancelDeletion(
        req.projectAdminContext.domain,
        req.projectAdminContext.personaUserId
      );

      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async listMembers(req, res, next) {
    try {
      const members = await projectMembershipService.listMembers(req.projectAdminContext.domain);

      res.json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }

  async addMember(req, res, next) {
    try {
      const { personaUserId } = req.body;

      // Guards against a dangling membership row for a nonexistent Persona
      // User — the service layer itself doesn't validate this reference.
      const targetUser = await userRepository.findById(personaUserId);
      if (!targetUser) {
        throw new NotFoundError('Persona User not found', 'User');
      }

      const membership = await projectMembershipService.addMember(
        req.projectAdminContext.domain,
        personaUserId,
        undefined,
        req.projectAdminContext.personaUserId
      );

      res.status(201).json({ success: true, data: membership });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req, res, next) {
    try {
      const membership = await projectMembershipService.removeMember(
        req.projectAdminContext.domain,
        req.params.personaUserId,
        req.projectAdminContext.personaUserId
      );

      res.json({ success: true, data: membership });
    } catch (error) {
      next(error);
    }
  }

  async listCredentials(req, res, next) {
    try {
      const credentials = await projectCredentialService.listCredentials(req.projectAdminContext);

      res.json({ success: true, data: credentials });
    } catch (error) {
      next(error);
    }
  }

  async mintCredential(req, res, next) {
    try {
      const credential = await projectCredentialService.createCredential(
        req.projectAdminContext,
        req.body
      );

      res.status(201).json({ success: true, data: credential });
    } catch (error) {
      next(error);
    }
  }

  async revokeCredential(req, res, next) {
    try {
      const credential = await projectCredentialService.revokeCredential(
        req.projectAdminContext,
        req.params.credentialId
      );

      res.json({ success: true, data: credential });
    } catch (error) {
      next(error);
    }
  }
}

export default new ProjectController();
