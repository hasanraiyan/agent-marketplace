/**
 * Canonical Agent Studio route table.
 *
 * Every creator-facing link in the app builds its href from here instead of
 * hardcoding a path string. Studio owns these routes; the legacy
 * /dashboard/connectors/** and /dashboard/settings/providers/** trees are
 * catch-all redirects that map onto this table.
 *
 * Moving a section later means editing this file, not grepping the codebase.
 */
export const studioRoutes = {
  home: "/studio",

  // ── Agents ────────────────────────────────────────────────────────────────
  agents: "/studio/agents",
  agentNew: "/studio/agents/new",
  agent: (id) => `/studio/agents/${id}`,
  agentBuild: (id) => `/studio/agents/${id}/build`,
  agentTest: (id) => `/studio/agents/${id}/test`,
  agentOnboarding: (id) => `/studio/agents/${id}/onboarding`,

  // ── Skills ────────────────────────────────────────────────────────────────
  skills: "/studio/skills",
  skillNew: "/studio/skills/new",
  skillsPublic: "/studio/skills/public",
  skill: (id) => `/studio/skills/${id}`,
  skillEdit: (id) => `/studio/skills/${id}/edit`,

  // ── Knowledge ─────────────────────────────────────────────────────────────
  knowledge: "/studio/knowledge",
  knowledgeNew: "/studio/knowledge/new",
  knowledgeBase: (id) => `/studio/knowledge/${id}`,

  // ── Connectors (MCP servers) ──────────────────────────────────────────────
  connectors: "/studio/connectors",
  connectorNew: "/studio/connectors/new",
  connector: (id) => `/studio/connectors/${id}`,
  connectorEdit: (id) => `/studio/connectors/${id}/edit`,

  // ── Memory ────────────────────────────────────────────────────────────────
  memory: "/studio/memory",

  // ── Providers ─────────────────────────────────────────────────────────────
  providers: "/studio/providers",
  providerNew: "/studio/providers/new",
  providerEdit: (id) => `/studio/providers/${id}/edit`,
};

/**
 * Consumer (Persona) routes that Studio needs to link back to.
 */
export const personaRoutes = {
  explore: "/dashboard",
  myAgents: "/dashboard/agents",
  agent: (id) => `/dashboard/agents/${id}`,
  agentRun: (id) => `/dashboard/agents/${id}/run`,
  settings: "/dashboard/settings",
};

/**
 * Legacy `/dashboard/connectors/<section>` segment → Studio section. Used by
 * the compatibility redirect so old deep links keep resolving.
 */
export const LEGACY_CONNECTOR_SECTIONS = {
  skills: "skills",
  knowledge: "knowledge",
  mcps: "connectors",
  memory: "memory",
};
