/**
 * Developer Platform — Project & ProjectMembership module (AD-03/AD-04/AD-08).
 *
 * Not yet mounted anywhere: no controller, no routes, no validator exist
 * for this module, and nothing in src/index.js imports this barrel. See the
 * master implementation blueprint §7, §34 Phase 2 — the Developer API
 * surface (routes/controllers) and the real credential model
 * (ProjectCredential) are separate, later work.
 */
export { default as Project, PROJECT_STATUS, SUSPENSION_AUTHORITY } from './project.model.js';
export { default as projectRepository } from './project.repository.js';
export { default as projectService } from './project.service.js';

export { default as ProjectMembership, MEMBERSHIP_ROLE } from './projectMembership.model.js';
export { default as projectMembershipRepository } from './projectMembership.repository.js';
export { default as projectMembershipService } from './projectMembership.service.js';
