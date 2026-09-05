import projectService from './project.service.js';
import projectMembershipService from './projectMembership.service.js';
import projectInvitationService from './projectInvitation.service.js';
import projectCredentialService from './projectCredential.service.js';
import userRepository from '../users/user.repository.js';
import { createPersonaPrincipalContext } from '../auth/personaPrincipalContext.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import agentService from '../agents/agent.service.js';
import skillService from '../skills/skill.service.js';
import knowledgeService from '../knowledge/knowledge.service.js';
import mcpService from '../mcp/mcp.service.js';
import projectSecretService from './projectSecret.service.js';
import restApiToolService from '../restApiTools/restApiTool.service.js';
import restApiToolSourceService from '../restApiToolSources/restApiToolSource.service.js';
import providerService from '../providers/provider.service.js';
import storeService from '../stores/store.service.js';
import auditLogService from '../audit/auditLog.service.js';
import { bulkDelete } from '../../utils/bulkDelete.js';
import { paginationEnvelope } from '../../utils/pagination.js';

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

  async createInvitation(req, res, next) {
    try {
      const invitation = await projectInvitationService.createInvitation(
        req.projectAdminContext.domain,
        req.body.email,
        req.projectAdminContext.personaUserId
      );

      res.status(201).json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  }

  async listInvitations(req, res, next) {
    try {
      const invitations = await projectInvitationService.listInvitations(
        req.projectAdminContext.domain
      );

      res.json({ success: true, data: invitations });
    } catch (error) {
      next(error);
    }
  }

  async revokeInvitation(req, res, next) {
    try {
      const invitation = await projectInvitationService.revokeInvitation(
        req.projectAdminContext.domain,
        req.params.invitationId,
        req.projectAdminContext.personaUserId
      );

      res.json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search active Persona Users by email prefix (case-insensitive) for the
   * "Add Admin" autocomplete. Admin-only (route-level). Returns minimal
   * profile fields (name + email) — never clerkId or role.
   */
  async searchMembers(req, res, next) {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const users = await userRepository.searchByEmailPrefix(q);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  async addMember(req, res, next) {
    try {
      const { personaUserId, email } = req.body;

      // Resolve by email when given (the human-friendly path — most Admins
      // know the invitee's email, not their internal User id). Emails are
      // stored lowercase, so normalize before lookup.
      let targetUser;
      if (email) {
        targetUser = await userRepository.findByEmail(email.trim().toLowerCase());
        // Parity with searchByEmailPrefix (which filters isActive) — a
        // deactivated account can't be invited by email either.
        if (targetUser && !targetUser.isActive) {
          throw new NotFoundError('Persona User not found', 'User');
        }
      } else {
        targetUser = await userRepository.findById(personaUserId);
      }

      // Guards against a dangling membership row for a nonexistent Persona
      // User — the service layer itself doesn't validate this reference.
      if (!targetUser) {
        throw new NotFoundError('Persona User not found', 'User');
      }

      const membership = await projectMembershipService.addMember(
        req.projectAdminContext.domain,
        targetUser._id,
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

  /**
   * Developer Platform (blueprint Phase 11, PR-55): read-only
   * resource-browsing for Developer Studio — `req.projectAdminContext` is
   * already an accepted `principalType` in each service's
   * `_buildDeveloperDiscoveryFilter` (built in PR-43-46), so these are thin
   * pass-throughs, not new authorization logic. Studio never uses a
   * Project's own machine credential — this is the Clerk-session-only read
   * path the user explicitly asked for.
   */
  async listAgents(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search, category: req.query.category };

      const agents = await agentService.discoverAgents(req.projectAdminContext, filters, {
        page,
        limit,
      });

      res.json({ success: true, data: agents });
    } catch (error) {
      next(error);
    }
  }

  async listSkills(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search };

      const skills = await skillService.discoverSkills(req.projectAdminContext, filters, {
        page,
        limit,
      });

      res.json({ success: true, data: skills });
    } catch (error) {
      next(error);
    }
  }

  async listStores(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search };

      const stores = await storeService.listStores(req.projectAdminContext.domain, filters, {
        page,
        limit,
      });

      res.json({ success: true, data: stores });
    } catch (error) {
      next(error);
    }
  }

  async listKnowledge(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search };

      const kbs = await knowledgeService.discoverKnowledgeBases(req.projectAdminContext, filters, {
        page,
        limit,
      });

      res.json({ success: true, data: kbs });
    } catch (error) {
      next(error);
    }
  }

  async listMcps(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search };

      const mcps = await mcpService.discoverMcps(req.projectAdminContext, filters, {
        page,
        limit,
      });

      res.json({ success: true, data: mcps.map((mcp) => mcpService.toSafeJson(mcp)) });
    } catch (error) {
      next(error);
    }
  }

  async listProviders(req, res, next) {
    try {
      const providers = await providerService.listProvidersForProject(req.projectAdminContext);

      res.json({ success: true, data: providers });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Developer Platform (Phase 11.5): full create/edit/delete for a
   * Project's own resources from Developer Studio (Clerk session), not
   * just the PR-55 read-only browse. Every method below is a thin
   * pass-through calling the exact same service method the SDK's
   * `developer*.controller.js` files already call, with
   * `req.projectAdminContext` in place of `req.projectContext` — no new
   * authorization logic, since `isResourceOwner`/`ownerFilterForContext`/
   * `ownerFieldsForContext` (and Agent's own `isAgentOwner`) already treat
   * `ProjectAdmin` identically to `ProjectMachine`.
   */
  async createProvider(req, res, next) {
    try {
      const provider = await providerService.createProvider(
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.status(201).json({ success: true, data: provider });
    } catch (error) {
      next(error);
    }
  }

  async updateProvider(req, res, next) {
    try {
      const provider = await providerService.updateProvider(
        undefined,
        req.params.providerId,
        req.body,
        req.projectAdminContext
      );
      res.json({ success: true, data: provider });
    } catch (error) {
      if (
        error.message === 'Provider not found' ||
        error.message === 'Unauthorized to update this provider'
      ) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      next(error);
    }
  }

  async deleteProvider(req, res, next) {
    try {
      await providerService.deleteProvider(
        undefined,
        req.params.providerId,
        req.projectAdminContext
      );
      res.json({ success: true, message: 'Provider deleted successfully' });
    } catch (error) {
      if (
        error.message === 'Provider not found' ||
        error.message === 'Unauthorized to delete this provider'
      ) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      next(error);
    }
  }

  async testProviderConnection(req, res, next) {
    try {
      const result = await providerService.testConnection(
        req.params.providerId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: result });
    } catch (error) {
      if (
        error.message === 'Provider not found' ||
        error.message === 'Unauthorized to test this provider'
      ) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getProviderModels(req, res, next) {
    try {
      const models = await providerService.getAvailableModels(
        req.params.providerId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: models });
    } catch (error) {
      if (
        error.message === 'Provider not found' ||
        error.message === 'Unauthorized to access this provider'
      ) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async createSkill(req, res, next) {
    try {
      const skill = await skillService.createSkill(undefined, req.body, req.projectAdminContext);
      res.status(201).json({ success: true, data: skill });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'A Skill with this exact name already exists' });
      }
      next(error);
    }
  }

  async updateSkill(req, res, next) {
    try {
      const skill = await skillService.updateSkill(
        req.params.skillId,
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.json({ success: true, data: skill });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another Skill with this name already exists' });
      }
      next(error);
    }
  }

  async deleteSkill(req, res, next) {
    try {
      await skillService.deleteSkill(req.params.skillId, undefined, req.projectAdminContext);
      res.json({ success: true, message: 'Skill deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async createStore(req, res, next) {
    try {
      const store = await storeService.createStore(req.projectAdminContext.domain, req.body);
      res.status(201).json({ success: true, data: store });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'A Store with this exact name already exists' });
      }
      next(error);
    }
  }

  async updateStore(req, res, next) {
    try {
      const store = await storeService.updateStore(
        req.projectAdminContext.domain,
        req.params.storeId,
        req.body
      );
      res.json({ success: true, data: store });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another Store with this name already exists' });
      }
      if (error.message === 'Store not found') {
        return res.status(404).json({ success: false, message: 'Store not found' });
      }
      next(error);
    }
  }

  async deleteStore(req, res, next) {
    try {
      await storeService.deleteStore(req.projectAdminContext.domain, req.params.storeId);
      res.json({ success: true, message: 'Store deleted successfully' });
    } catch (error) {
      if (error.message === 'Store not found') {
        return res.status(404).json({ success: false, message: 'Store not found' });
      }
      next(error);
    }
  }

  async createKnowledge(req, res, next) {
    try {
      const kb = await knowledgeService.createKnowledgeBase(
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.status(201).json({ success: true, data: kb });
    } catch (error) {
      next(error);
    }
  }

  async updateKnowledge(req, res, next) {
    try {
      const kb = await knowledgeService.updateKnowledgeBase(
        req.params.kbId,
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.json({ success: true, data: kb });
    } catch (error) {
      next(error);
    }
  }

  async deleteKnowledge(req, res, next) {
    try {
      await knowledgeService.deleteKnowledgeBase(
        req.params.kbId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, message: 'Knowledge base deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async uploadKnowledgeDocuments(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded. Please select at least one file.',
        });
      }

      const result = await knowledgeService.uploadFiles(
        req.params.kbId,
        undefined,
        req.files,
        req.projectAdminContext
      );

      res.json({
        success: true,
        data: result,
        message: `${result.files.length} file(s) processed successfully`,
      });
    } catch (error) {
      if (
        error.message === 'Knowledge base not found' ||
        error.message === 'Not authorized to upload to this knowledge base'
      ) {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      next(error);
    }
  }

  async listKnowledgeDocuments(req, res, next) {
    try {
      const documents = await knowledgeService.listDocumentSources(
        req.params.kbId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: documents });
    } catch (error) {
      if (error.message === 'Knowledge base not found' || error.message === 'Not authorized') {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      next(error);
    }
  }

  async deleteKnowledgeDocument(req, res, next) {
    try {
      const sourceName = decodeURIComponent(req.params.sourceName);
      const result = await knowledgeService.deleteDocumentFromKb(
        req.params.kbId,
        undefined,
        sourceName,
        req.projectAdminContext
      );
      res.json({
        success: true,
        data: result,
        message: `Document deleted. ${result.removedChunks} chunk(s) removed.`,
      });
    } catch (error) {
      if (
        error.message === 'Knowledge base not found' ||
        error.message === 'Not authorized to modify this knowledge base'
      ) {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      if (error.message?.startsWith('Document')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async createMcp(req, res, next) {
    try {
      const mcp = await mcpService.createMcp(undefined, req.body, req.projectAdminContext);
      res.status(201).json({ success: true, data: mcpService.toSafeJson(mcp) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'An MCP server with this exact name already exists' });
      }
      next(error);
    }
  }

  async updateMcp(req, res, next) {
    try {
      const mcp = await mcpService.updateMcp(
        req.params.mcpId,
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.json({ success: true, data: mcpService.toSafeJson(mcp) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another MCP server with this name already exists' });
      }
      next(error);
    }
  }

  async deleteMcp(req, res, next) {
    try {
      await mcpService.deleteMcp(req.params.mcpId, undefined, req.projectAdminContext);
      res.json({ success: true, message: 'MCP server deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getMcpOwnerAuthorizeUrl(req, res, next) {
    try {
      const url = await mcpService.getOwnerAuthorizationUrl(
        req.params.mcpId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: { url } });
    } catch (error) {
      if (error.message === 'MCP server not found') {
        return res.status(404).json({ success: false, message: 'MCP server not found' });
      }
      next(error);
    }
  }

  async disconnectMcpOwnerConnection(req, res, next) {
    try {
      await mcpService.disconnectOwnerConnection(
        req.params.mcpId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, message: 'Owner connection disconnected' });
    } catch (error) {
      if (error.message === 'MCP server not found') {
        return res.status(404).json({ success: false, message: 'MCP server not found' });
      }
      next(error);
    }
  }

  /**
   * Developer Platform (Phase 11.5, PR-61): full create/edit/delete for a
   * Project's own Agents from Developer Studio. Same reasoning as PR-60 —
   * `agentService.createDeveloperAgent`/`updateAgent`/`deleteAgent` already
   * accept `ProjectAdminContext` via the shared `isAgentOwner` helper, so
   * this is a thin pass-through mirroring `developerAgent.controller.js`
   * exactly, with `req.projectAdminContext` in place of `req.projectContext`.
   */
  async createAgent(req, res, next) {
    try {
      const agent = await agentService.createDeveloperAgent(req.projectAdminContext, req.body);
      res.status(201).json({ success: true, data: agent });
    } catch (error) {
      next(error);
    }
  }

  async updateAgent(req, res, next) {
    try {
      const agent = await agentService.updateAgent(
        req.params.agentId,
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.json({ success: true, data: agent });
    } catch (error) {
      next(error);
    }
  }

  async deleteAgent(req, res, next) {
    try {
      await agentService.deleteAgent(req.params.agentId, undefined, req.projectAdminContext);
      res.json({ success: true, message: 'Agent deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async bulkDeleteAgents(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        agentService.deleteAgent(id, undefined, req.projectAdminContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Developer Studio parity with the SDK's `developer*.controller.js`
   * getUsage/bulkDelete/search endpoints — same thin pass-through pattern
   * as createProvider/updateProvider/etc. above, just with
   * `req.projectAdminContext` in place of `req.projectContext`. Agent has
   * no getUsage equivalent (nothing else references an Agent the way
   * Provider/Skill/MCP/Knowledge are referenced by one).
   */
  async getProviderUsage(req, res, next) {
    try {
      const usage = await providerService.getProviderUsage(
        req.params.providerId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: usage });
    } catch (error) {
      if (error.message === 'Provider not found') {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      next(error);
    }
  }

  async bulkDeleteProviders(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        providerService.deleteProvider(undefined, id, req.projectAdminContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getSkillUsage(req, res, next) {
    try {
      const usage = await skillService.getSkillUsage(
        req.params.skillId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: usage });
    } catch (error) {
      if (error.message === 'Skill not found') {
        return res.status(404).json({ success: false, message: 'Skill not found' });
      }
      next(error);
    }
  }

  async bulkDeleteSkills(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        skillService.deleteSkill(id, undefined, req.projectAdminContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getKnowledgeUsage(req, res, next) {
    try {
      const usage = await knowledgeService.getKnowledgeBaseUsage(
        req.params.kbId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: usage });
    } catch (error) {
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      next(error);
    }
  }

  async bulkDeleteKnowledge(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        knowledgeService.deleteKnowledgeBase(id, undefined, req.projectAdminContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async searchKnowledge(req, res, next) {
    try {
      const { query, topK } = req.body;
      const results = await knowledgeService.searchKnowledgeBase(
        req.params.kbId,
        query,
        { topK },
        req.projectAdminContext
      );
      res.json({ success: true, data: results });
    } catch (error) {
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      next(error);
    }
  }

  async getMcpUsage(req, res, next) {
    try {
      const usage = await mcpService.getMcpUsage(
        req.params.mcpId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: usage });
    } catch (error) {
      if (error.message === 'MCP not found') {
        return res.status(404).json({ success: false, message: 'MCP not found' });
      }
      next(error);
    }
  }

  async bulkDeleteMcps(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        mcpService.deleteMcp(id, undefined, req.projectAdminContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async createSecret(req, res, next) {
    try {
      const secret = await projectSecretService.createSecret(req.projectAdminContext, req.body);
      res.status(201).json({ success: true, data: secret });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'A secret with this exact label already exists' });
      }
      next(error);
    }
  }

  async listSecrets(req, res, next) {
    try {
      const secrets = await projectSecretService.listSecrets(req.projectAdminContext);
      res.json({ success: true, data: secrets });
    } catch (error) {
      next(error);
    }
  }

  async updateSecret(req, res, next) {
    try {
      const secret = await projectSecretService.updateSecret(
        req.projectAdminContext,
        req.params.secretId,
        req.body
      );
      res.json({ success: true, data: secret });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another secret with this label already exists' });
      }
      next(error);
    }
  }

  async deleteSecret(req, res, next) {
    try {
      await projectSecretService.deleteSecret(req.projectAdminContext, req.params.secretId);
      res.json({ success: true, message: 'Secret deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getSecretUsage(req, res, next) {
    try {
      const usage = await projectSecretService.getSecretUsage(
        req.projectAdminContext,
        req.params.secretId
      );
      res.json({ success: true, data: usage });
    } catch (error) {
      next(error);
    }
  }

  async bulkDeleteSecrets(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        projectSecretService.deleteSecret(req.projectAdminContext, id)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async listRestApiTools(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search };

      const tools = await restApiToolService.discoverRestApiTools(req.projectAdminContext, filters, {
        page,
        limit,
      });

      res.json({ success: true, data: tools.map((tool) => restApiToolService.toSafeJson(tool)) });
    } catch (error) {
      next(error);
    }
  }

  async createRestApiTool(req, res, next) {
    try {
      const tool = await restApiToolService.createRestApiTool(
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.status(201).json({ success: true, data: restApiToolService.toSafeJson(tool) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'A REST API tool with this exact name already exists' });
      }
      next(error);
    }
  }

  async updateRestApiTool(req, res, next) {
    try {
      const tool = await restApiToolService.updateRestApiTool(
        req.params.toolId,
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.json({ success: true, data: restApiToolService.toSafeJson(tool) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another REST API tool with this name already exists' });
      }
      next(error);
    }
  }

  async deleteRestApiTool(req, res, next) {
    try {
      await restApiToolService.deleteRestApiTool(req.params.toolId, undefined, req.projectAdminContext);
      res.json({ success: true, message: 'REST API tool deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getRestApiToolUsage(req, res, next) {
    try {
      const usage = await restApiToolService.getRestApiToolUsage(
        req.params.toolId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: usage });
    } catch (error) {
      next(error);
    }
  }

  async bulkDeleteRestApiTools(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        restApiToolService.deleteRestApiTool(id, undefined, req.projectAdminContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async testRestApiTool(req, res, next) {
    try {
      const toolId = req.params.toolId || req.body.toolId || null;
      let toolDraft = req.body.draft;

      if (!toolDraft && toolId) {
        toolDraft = await restApiToolService.getRestApiToolById(
          toolId,
          undefined,
          req.projectAdminContext
        );
      }
      if (!toolDraft) {
        return res
          .status(400)
          .json({ success: false, message: 'Either toolId or draft is required' });
      }

      const result = await restApiToolService.testCall(
        req.projectAdminContext,
        toolDraft,
        req.body.testValues || {},
        toolId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async listRestApiToolSources(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search };

      const sources = await restApiToolSourceService.discoverRestApiToolSources(
        req.projectAdminContext,
        filters,
        { page, limit }
      );

      res.json({
        success: true,
        data: sources.map((source) => restApiToolSourceService.toSafeJson(source)),
      });
    } catch (error) {
      next(error);
    }
  }

  async createRestApiToolSource(req, res, next) {
    try {
      const source = await restApiToolSourceService.createRestApiToolSource(
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.status(201).json({ success: true, data: restApiToolSourceService.toSafeJson(source) });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'A REST API tool source with this exact name already exists',
        });
      }
      next(error);
    }
  }

  async updateRestApiToolSource(req, res, next) {
    try {
      const source = await restApiToolSourceService.updateRestApiToolSource(
        req.params.sourceId,
        undefined,
        req.body,
        req.projectAdminContext
      );
      res.json({ success: true, data: restApiToolSourceService.toSafeJson(source) });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Another REST API tool source with this name already exists',
        });
      }
      next(error);
    }
  }

  async deleteRestApiToolSource(req, res, next) {
    try {
      await restApiToolSourceService.deleteRestApiToolSource(
        req.params.sourceId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, message: 'REST API tool source deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getRestApiToolSourceUsage(req, res, next) {
    try {
      const usage = await restApiToolSourceService.getRestApiToolSourceUsage(
        req.params.sourceId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: usage });
    } catch (error) {
      next(error);
    }
  }

  async bulkDeleteRestApiToolSources(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        restApiToolSourceService.deleteRestApiToolSource(id, undefined, req.projectAdminContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async testRestApiToolSource(req, res, next) {
    try {
      const result = await restApiToolSourceService.testConnection(
        req.params.sourceId,
        undefined,
        req.projectAdminContext
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Developer Studio (Feature 6 parity) — read access to this Project's
   * audit trail. Covers Project-lifecycle events only (credential minted/
   * revoked, membership changes, suspend/restore) — see
   * auditLog.service.js's own docstring; resource CRUD isn't logged here.
   */
  async listAuditLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { eventType: req.query.eventType };

      const [logs, total] = await Promise.all([
        auditLogService.listForDomain(req.projectAdminContext.domain, filters, { page, limit }),
        auditLogService.countForDomain(req.projectAdminContext.domain, filters),
      ]);

      res.json({ success: true, data: paginationEnvelope(logs, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }
}

export default new ProjectController();
