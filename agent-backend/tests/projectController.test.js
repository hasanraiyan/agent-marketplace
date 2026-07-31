import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/project.service.js', () => ({
  default: {
    createProject: jest.fn(),
    listProjectsForUser: jest.fn(),
    getProjectById: jest.fn(),
    updateMetadata: jest.fn(),
    suspendProject: jest.fn(),
    reactivateProject: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectMembership.service.js', () => ({
  default: {
    listMembers: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectCredential.service.js', () => ({
  default: {
    listCredentials: jest.fn(),
    createCredential: jest.fn(),
    revokeCredential: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/users/user.repository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

const projectService = (await import('../src/modules/projects/project.service.js')).default;
const projectMembershipService = (
  await import('../src/modules/projects/projectMembership.service.js')
).default;
const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const userRepository = (await import('../src/modules/users/user.repository.js')).default;
const projectController = (await import('../src/modules/projects/project.controller.js')).default;

describe('Project Controller', () => {
  const personaUserId = 'user_123';
  const projectId = 'project_1';
  const adminContext = {
    domain: projectId,
    principalType: 'ProjectAdmin',
    personaUserId,
    membershipRole: 'Admin',
  };

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { _id: personaUserId },
      body: {},
      params: {},
      projectAdminContext: adminContext,
    };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('create', () => {
    test('creates a Project from a PersonaPrincipalContext derived from req.user', async () => {
      mockReq.body = { name: 'Beyond Campus' };
      projectService.createProject.mockResolvedValue({ _id: 'p1', name: 'Beyond Campus' });

      await projectController.create(mockReq, mockRes, next);

      expect(projectService.createProject).toHaveBeenCalledWith(
        { domain: 'persona', principalType: 'PersonaUser', personaUserId },
        { name: 'Beyond Campus' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: 'p1', name: 'Beyond Campus' },
      });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      projectService.createProject.mockRejectedValue(err);

      await projectController.create(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('listMine', () => {
    test('lists Projects for the authenticated user', async () => {
      projectService.listProjectsForUser.mockResolvedValue([{ _id: 'p1' }]);

      await projectController.listMine(mockReq, mockRes, next);

      expect(projectService.listProjectsForUser).toHaveBeenCalledWith(personaUserId);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 'p1' }] });
    });
  });

  describe('getOne', () => {
    test('reads the Project id from req.projectAdminContext.domain, not a body/query value', async () => {
      projectService.getProjectById.mockResolvedValue({ _id: projectId });

      await projectController.getOne(mockReq, mockRes, next);

      expect(projectService.getProjectById).toHaveBeenCalledWith(projectId);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: { _id: projectId } });
    });
  });

  describe('updateMetadata', () => {
    test('updates using the admin-context-resolved project id', async () => {
      mockReq.body = { name: 'New Name' };
      projectService.updateMetadata.mockResolvedValue({ _id: projectId, name: 'New Name' });

      await projectController.updateMetadata(mockReq, mockRes, next);

      expect(projectService.updateMetadata).toHaveBeenCalledWith(
        projectId,
        { name: 'New Name' },
        personaUserId
      );
    });
  });

  describe('suspend', () => {
    test('suspends using req.projectAdminContext.personaUserId + domain', async () => {
      projectService.suspendProject.mockResolvedValue({ _id: projectId, status: 'SUSPENDED' });

      await projectController.suspend(mockReq, mockRes, next);

      expect(projectService.suspendProject).toHaveBeenCalledWith(personaUserId, projectId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: projectId, status: 'SUSPENDED' },
      });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      projectService.suspendProject.mockRejectedValue(err);

      await projectController.suspend(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('reactivate', () => {
    test('reactivates using req.projectAdminContext.domain', async () => {
      projectService.reactivateProject.mockResolvedValue({ _id: projectId, status: 'ACTIVE' });

      await projectController.reactivate(mockReq, mockRes, next);

      expect(projectService.reactivateProject).toHaveBeenCalledWith(projectId, personaUserId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: projectId, status: 'ACTIVE' },
      });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      projectService.reactivateProject.mockRejectedValue(err);

      await projectController.reactivate(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('addMember', () => {
    test('validates the target Persona User exists before creating the membership', async () => {
      mockReq.body = { personaUserId: 'target_1' };
      userRepository.findById.mockResolvedValue({ _id: 'target_1' });
      projectMembershipService.addMember.mockResolvedValue({
        project: projectId,
        personaUserId: 'target_1',
        role: 'Admin',
      });

      await projectController.addMember(mockReq, mockRes, next);

      expect(userRepository.findById).toHaveBeenCalledWith('target_1');
      expect(projectMembershipService.addMember).toHaveBeenCalledWith(
        projectId,
        'target_1',
        undefined,
        personaUserId
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('404s without calling the service when the target Persona User does not exist', async () => {
      mockReq.body = { personaUserId: 'ghost' };
      userRepository.findById.mockResolvedValue(null);

      await projectController.addMember(mockReq, mockRes, next);

      expect(projectMembershipService.addMember).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe('removeMember', () => {
    test('removes using the admin-context-resolved project id and the :personaUserId param', async () => {
      mockReq.params = { personaUserId: 'target_1' };
      projectMembershipService.removeMember.mockResolvedValue({ personaUserId: 'target_1' });

      await projectController.removeMember(mockReq, mockRes, next);

      expect(projectMembershipService.removeMember).toHaveBeenCalledWith(
        projectId,
        'target_1',
        personaUserId
      );
    });
  });

  describe('mintCredential', () => {
    test('mints using req.projectAdminContext, never a client-supplied project id', async () => {
      mockReq.body = { label: 'prod key' };
      projectCredentialService.createCredential.mockResolvedValue({
        keyId: 'pk_1',
        secret: 'shown-once',
      });

      await projectController.mintCredential(mockReq, mockRes, next);

      expect(projectCredentialService.createCredential).toHaveBeenCalledWith(adminContext, {
        label: 'prod key',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { keyId: 'pk_1', secret: 'shown-once' },
      });
    });
  });

  describe('revokeCredential', () => {
    test('revokes using req.projectAdminContext and the :credentialId param', async () => {
      mockReq.params = { credentialId: 'cred_1' };
      projectCredentialService.revokeCredential.mockResolvedValue({
        id: 'cred_1',
        status: 'REVOKED',
      });

      await projectController.revokeCredential(mockReq, mockRes, next);

      expect(projectCredentialService.revokeCredential).toHaveBeenCalledWith(
        adminContext,
        'cred_1'
      );
    });
  });

  describe('listCredentials', () => {
    test('lists using req.projectAdminContext', async () => {
      projectCredentialService.listCredentials.mockResolvedValue([{ keyId: 'pk_1' }]);

      await projectController.listCredentials(mockReq, mockRes, next);

      expect(projectCredentialService.listCredentials).toHaveBeenCalledWith(adminContext);
    });
  });

  describe('listMembers', () => {
    test('lists using req.projectAdminContext', async () => {
      projectMembershipService.listMembers.mockResolvedValue([{ personaUserId }]);

      await projectController.listMembers(mockReq, mockRes, next);

      expect(projectMembershipService.listMembers).toHaveBeenCalledWith(projectId);
    });
  });
});
