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
};
