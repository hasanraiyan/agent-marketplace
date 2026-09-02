/**
 * Canonical Developer Studio route table.
 *
 * Every link in the /developer surface builds its href from here instead of
 * hardcoding a path string — same convention as studioRoutes
 * (src/lib/studio-routes.js). Developer Studio is a third, separate route
 * tree alongside /dashboard and /studio (blueprint §29): a Project Admin
 * manages their Project here via their own Clerk session, never via the
 * Project's own minted API credential.
 */
export const developerRoutes = {
  home: "/developer",

  // ── Projects ──────────────────────────────────────────────────────────────
  projects: "/developer/projects",
  projectNew: "/developer/projects/new",
  project: (id) => `/developer/projects/${id}`,

  // ── Project resources (blueprint Phase 11.5) ─────────────────────────────
  projectProviderNew: (id) => `/developer/projects/${id}/providers/new`,
  projectProviderEdit: (id, providerId) =>
    `/developer/projects/${id}/providers/${providerId}/edit`,
  projectSkillNew: (id) => `/developer/projects/${id}/skills/new`,
  projectSkillEdit: (id, skillId) =>
    `/developer/projects/${id}/skills/${skillId}/edit`,
  projectKnowledgeNew: (id) => `/developer/projects/${id}/knowledge/new`,
  projectKnowledgeDetail: (id, kbId) =>
    `/developer/projects/${id}/knowledge/${kbId}`,
  projectMcpNew: (id) => `/developer/projects/${id}/mcps/new`,
  projectMcpEdit: (id, mcpId) => `/developer/projects/${id}/mcps/${mcpId}/edit`,
  projectRestToolNew: (id) => `/developer/projects/${id}/rest-tools/new`,
  projectRestToolEdit: (id, toolId) =>
    `/developer/projects/${id}/rest-tools/${toolId}/edit`,
  projectAgentNew: (id) => `/developer/projects/${id}/agents/new`,
  projectAgentEdit: (id, agentId) =>
    `/developer/projects/${id}/agents/${agentId}/edit`,
  projectAgentTest: (id, agentId) =>
    `/developer/projects/${id}/agents/${agentId}/test`,
  projectStoreNew: (id) => `/developer/projects/${id}/stores/new`,
  projectStoreEdit: (id, storeId) =>
    `/developer/projects/${id}/stores/${storeId}/edit`,
};
