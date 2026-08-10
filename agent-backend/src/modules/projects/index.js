/**
 * Developer Platform — Project, ProjectMembership & ProjectCredential module
 * (AD-01/AD-03/AD-04/AD-08).
 *
 * Mounted at `/api/v1/projects` (blueprint §7, §34 Phase 8, PR-19) — Clerk-
 * authenticated Persona Users create/list their own Projects and manage
 * membership/credentials for Projects they administer. This is the admin
 * control-plane surface only; the Project-credential-authenticated runtime
 * surface (developerMachineAuth.middleware.js) is separate, later work.
 */
export { default as Project, PROJECT_STATUS, SUSPENSION_AUTHORITY } from './project.model.js';
export { default as projectRepository } from './project.repository.js';
export { default as projectService } from './project.service.js';

export { default as ProjectMembership, MEMBERSHIP_ROLE } from './projectMembership.model.js';
export { default as projectMembershipRepository } from './projectMembership.repository.js';
export { default as projectMembershipService } from './projectMembership.service.js';

export { default as ProjectCredential, CREDENTIAL_STATUS } from './projectCredential.model.js';
export { default as projectCredentialRepository } from './projectCredential.repository.js';
export { default as projectCredentialService } from './projectCredential.service.js';

export { default as ProjectInvitation, INVITATION_STATUS } from './projectInvitation.model.js';
export { default as projectInvitationRepository } from './projectInvitation.repository.js';
export { default as projectInvitationService } from './projectInvitation.service.js';

export { default as projectRouter } from './project.routes.js';
export { default as projectController } from './project.controller.js';
export { default as projectArchitectAguiRouter } from './projectArchitect.routes.js';
export { default as projectAgentTestAguiRouter } from './projectAgentTest.routes.js';
export {
  createProjectSchema,
  updateProjectSchema,
  addMemberSchema,
  createCredentialSchema,
  createInvitationSchema,
} from './project.validator.js';
