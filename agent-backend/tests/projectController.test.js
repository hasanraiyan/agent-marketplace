import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/project.service.js', () => ({
  default: {
    createProject: jest.fn(),
    listProjectsForUser: jest.fn(),
    getProjectById: jest.fn(),
    updateMetadata: jest.fn(),
    suspendProject: jest.fn(),
    reactivateProject: jest.fn(),
    requestDeletion: jest.fn(),
    cancelDeletion: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectMembership.service.js', () => ({
  default: {
    listMembers: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectInvitation.service.js', () => ({
  default: {
    createInvitation: jest.fn(),
    listInvitations: jest.fn(),
    revokeInvitation: jest.fn(),
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
    findByEmail: jest.fn(),
    searchByEmailPrefix: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.service.js', () => ({
  default: { discoverAgents: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/skills/skill.service.js', () => ({
  default: { discoverSkills: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/knowledge/knowledge.service.js', () => ({
  default: { discoverKnowledgeBases: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/mcp/mcp.service.js', () => ({
  default: { discoverMcps: jest.fn(), toSafeJson: jest.fn((mcp) => ({ ...mcp, safe: true })) },
}));
jest.unstable_mockModule('../src/modules/providers/provider.service.js', () => ({
  default: { listProvidersForProject: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/stores/store.service.js', () => ({
  default: {
    listStores: jest.fn(),
    createStore: jest.fn(),
    updateStore: jest.fn(),
    deleteStore: jest.fn(),
  },
}));

const projectService = (await import('../src/modules/projects/project.service.js')).default;
const projectMembershipService = (
  await import('../src/modules/projects/projectMembership.service.js')
).default;
const projectInvitationService = (
  await import('../src/modules/projects/projectInvitation.service.js')
).default;
const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const userRepository = (await import('../src/modules/users/user.repository.js')).default;
const agentService = (await import('../src/modules/agents/agent.service.js')).default;
const skillService = (await import('../src/modules/skills/skill.service.js')).default;
const knowledgeService = (await import('../src/modules/knowledge/knowledge.service.js')).default;
const mcpService = (await import('../src/modules/mcp/mcp.service.js')).default;
const providerService = (await import('../src/modules/providers/provider.service.js')).default;
const storeService = (await import('../src/modules/stores/store.service.js')).default;
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
      query: {},
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

  describe('requestDeletion', () => {
    test('requests deletion using req.projectAdminContext.domain + personaUserId', async () => {
      projectService.requestDeletion.mockResolvedValue({ _id: projectId, status: 'DELETING' });

      await projectController.requestDeletion(mockReq, mockRes, next);

      expect(projectService.requestDeletion).toHaveBeenCalledWith(projectId, personaUserId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: projectId, status: 'DELETING' },
      });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      projectService.requestDeletion.mockRejectedValue(err);

      await projectController.requestDeletion(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('cancelDeletion', () => {
    test('cancels deletion using req.projectAdminContext.domain + personaUserId', async () => {
      projectService.cancelDeletion.mockResolvedValue({ _id: projectId, status: 'ACTIVE' });

      await projectController.cancelDeletion(mockReq, mockRes, next);

      expect(projectService.cancelDeletion).toHaveBeenCalledWith(projectId, personaUserId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: projectId, status: 'ACTIVE' },
      });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      projectService.cancelDeletion.mockRejectedValue(err);

      await projectController.cancelDeletion(mockReq, mockRes, next);

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

    test('resolves an email to the target user id before adding the membership', async () => {
      mockReq.body = { email: 'sabik@beyond.campus' };
      userRepository.findByEmail.mockResolvedValue({
        _id: 'resolved_id',
        email: 'sabik@beyond.campus',
        isActive: true,
      });
      projectMembershipService.addMember.mockResolvedValue({
        project: projectId,
        personaUserId: 'resolved_id',
        role: 'Admin',
      });

      await projectController.addMember(mockReq, mockRes, next);

      expect(userRepository.findByEmail).toHaveBeenCalledWith('sabik@beyond.campus');
      expect(projectMembershipService.addMember).toHaveBeenCalledWith(
        projectId,
        'resolved_id',
        undefined,
        personaUserId
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('passes email-lookup errors to next without adding a membership', async () => {
      mockReq.body = { email: 'nobody@example.com' };
      const err = new Error('User with email nobody@example.com not found');
      err.statusCode = 404;
      userRepository.findByEmail.mockRejectedValue(err);

      await projectController.addMember(mockReq, mockRes, next);

      expect(projectMembershipService.addMember).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(err);
    });

    test('404s when the email resolves to a deactivated user (parity with search isActive filter)', async () => {
      mockReq.body = { email: 'gone@example.com' };
      userRepository.findByEmail.mockResolvedValue({
        _id: 'inactive_id',
        isActive: false,
      });

      await projectController.addMember(mockReq, mockRes, next);

      expect(projectMembershipService.addMember).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe('searchMembers', () => {
    test('searches active users by email prefix and returns minimal profile fields', async () => {
      mockReq.query = { q: 'sabik@' };
      userRepository.searchByEmailPrefix.mockResolvedValue([
        { id: 'u1', name: 'Sabik', email: 'sabik@beyond.campus' },
      ]);

      await projectController.searchMembers(mockReq, mockRes, next);

      expect(userRepository.searchByEmailPrefix).toHaveBeenCalledWith('sabik@');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 'u1', name: 'Sabik', email: 'sabik@beyond.campus' }],
      });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      userRepository.searchByEmailPrefix.mockRejectedValue(err);

      await projectController.searchMembers(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
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

  describe('invitations', () => {
    test('createInvitation forwards domain + email + caller and responds 201', async () => {
      mockReq.body = { email: 'new@beyond.campus' };
      projectInvitationService.createInvitation.mockResolvedValue({
        email: 'new@beyond.campus',
        status: 'pending',
      });

      await projectController.createInvitation(mockReq, mockRes, next);

      expect(projectInvitationService.createInvitation).toHaveBeenCalledWith(
        projectId,
        'new@beyond.campus',
        personaUserId
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { email: 'new@beyond.campus', status: 'pending' },
      });
    });

    test('listInvitations forwards domain', async () => {
      projectInvitationService.listInvitations.mockResolvedValue([{ email: 'a@b.c' }]);

      await projectController.listInvitations(mockReq, mockRes, next);

      expect(projectInvitationService.listInvitations).toHaveBeenCalledWith(projectId);
    });

    test('revokeInvitation forwards domain + :invitationId + caller', async () => {
      mockReq.params = { invitationId: 'inv_1' };
      projectInvitationService.revokeInvitation.mockResolvedValue({ status: 'revoked' });

      await projectController.revokeInvitation(mockReq, mockRes, next);

      expect(projectInvitationService.revokeInvitation).toHaveBeenCalledWith(
        projectId,
        'inv_1',
        personaUserId
      );
    });
  });

  describe('resource-browsing (blueprint Phase 11, PR-55)', () => {
    test('listAgents forwards req.projectAdminContext, never a machine credential context', async () => {
      mockReq.query = { search: 'foo', page: '2', limit: '5' };
      agentService.discoverAgents.mockResolvedValue([{ _id: 'agent1' }]);

      await projectController.listAgents(mockReq, mockRes, next);

      expect(agentService.discoverAgents).toHaveBeenCalledWith(
        adminContext,
        { search: 'foo', category: undefined },
        { page: 2, limit: 5 }
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 'agent1' }] });
    });

    test('listSkills forwards req.projectAdminContext', async () => {
      skillService.discoverSkills.mockResolvedValue([{ _id: 'skill1' }]);

      await projectController.listSkills(mockReq, mockRes, next);

      expect(skillService.discoverSkills).toHaveBeenCalledWith(
        adminContext,
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('listStores forwards req.projectAdminContext.domain, not the whole context object', async () => {
      storeService.listStores.mockResolvedValue([{ _id: 'store1' }]);

      await projectController.listStores(mockReq, mockRes, next);

      expect(storeService.listStores).toHaveBeenCalledWith(
        projectId,
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('listKnowledge forwards req.projectAdminContext', async () => {
      knowledgeService.discoverKnowledgeBases.mockResolvedValue([{ _id: 'kb1' }]);

      await projectController.listKnowledge(mockReq, mockRes, next);

      expect(knowledgeService.discoverKnowledgeBases).toHaveBeenCalledWith(
        adminContext,
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('listMcps forwards req.projectAdminContext and strips secrets via toSafeJson', async () => {
      mcpService.discoverMcps.mockResolvedValue([{ _id: 'mcp1', apiKeyEncrypted: 'enc:x' }]);

      await projectController.listMcps(mockReq, mockRes, next);

      expect(mcpService.discoverMcps).toHaveBeenCalledWith(
        adminContext,
        expect.any(Object),
        expect.any(Object)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [{ _id: 'mcp1', apiKeyEncrypted: 'enc:x', safe: true }],
      });
    });

    test('listProviders forwards req.projectAdminContext (no pagination, Provider has no discovery filter)', async () => {
      providerService.listProvidersForProject.mockResolvedValue([{ _id: 'provider1' }]);

      await projectController.listProviders(mockReq, mockRes, next);

      expect(providerService.listProvidersForProject).toHaveBeenCalledWith(adminContext);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 'provider1' }] });
    });

    test('passes errors to next for each new method', async () => {
      const err = new Error('boom');
      agentService.discoverAgents.mockRejectedValue(err);

      await projectController.listAgents(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('stores CRUD', () => {
    test('createStore forwards req.projectAdminContext.domain', async () => {
      mockReq.body = { name: 'notes', scope: 'domain' };
      storeService.createStore.mockResolvedValue({ _id: 's1', name: 'notes' });

      await projectController.createStore(mockReq, mockRes, next);

      expect(storeService.createStore).toHaveBeenCalledWith(projectId, mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('createStore 409s on a duplicate name', async () => {
      storeService.createStore.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

      await projectController.createStore(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(next).not.toHaveBeenCalled();
    });

    test('updateStore forwards domain + storeId', async () => {
      mockReq.params = { storeId: 's1' };
      mockReq.body = { description: 'updated' };
      storeService.updateStore.mockResolvedValue({ _id: 's1', description: 'updated' });

      await projectController.updateStore(mockReq, mockRes, next);

      expect(storeService.updateStore).toHaveBeenCalledWith(projectId, 's1', {
        description: 'updated',
      });
    });

    test('deleteStore 404s when the store does not exist', async () => {
      mockReq.params = { storeId: 's1' };
      storeService.deleteStore.mockRejectedValue(new Error('Store not found'));

      await projectController.deleteStore(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
