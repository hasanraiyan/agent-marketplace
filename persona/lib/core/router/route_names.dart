/// Route path constants for GoRouter.
class RouteNames {
  RouteNames._();

  // ── Pre-auth ─────────────────────────────────────────────────────────────────
  static const String splash = '/';
  static const String onboarding = '/onboarding';
  static const String login = '/login';

  // ── Marketplace tab ──────────────────────────────────────────────────────────
  static const String marketplace = '/marketplace';
  static const String agentDetail = '/marketplace/agents/:id';
  static String agentDetailPath(String id) => '/marketplace/agents/$id';

  // ── Chats tab ────────────────────────────────────────────────────────────────
  static const String chats = '/chats';
  static const String chat = '/chats/:threadId';
  static String chatPath(String threadId) => '/chats/$threadId';

  // ── My Agents tab ────────────────────────────────────────────────────────────
  static const String myAgents = '/agents';
  static const String agentNew = '/agents/new';
  static const String agentEdit = '/agents/:id/edit';
  static String agentEditPath(String id) => '/agents/$id/edit';

  // ── Profile tab ──────────────────────────────────────────────────────────────
  static const String profile = '/profile';
  static const String providers = '/profile/providers';
  static const String providerNew = '/profile/providers/new';
  static const String providerEdit = '/profile/providers/:id';
  static String providerEditPath(String id) => '/profile/providers/$id';

  // Legacy profile connector paths kept as redirects for older links.
  static const String legacyMcps = '/profile/mcps';
  static const String legacySkills = '/profile/skills';
  static const String legacyKnowledge = '/profile/knowledge';

  // Connectors hub
  static const String connectors = '/connectors';

  // MCP Servers
  static const String mcps = '/connectors/mcps';
  static const String mcpNew = '/connectors/mcps/new';
  static const String mcpDetail = '/connectors/mcps/:id';
  static const String mcpEdit = '/connectors/mcps/:id/edit';
  static String mcpDetailPath(String id) => '/connectors/mcps/$id';
  static String mcpEditPath(String id) => '/connectors/mcps/$id/edit';

  // Skills
  static const String skills = '/connectors/skills';
  static const String skillNew = '/connectors/skills/new';
  static const String skillPublic = '/connectors/skills/public';
  static const String skillDetail = '/connectors/skills/:id';
  static const String skillEdit = '/connectors/skills/:id/edit';
  static String skillDetailPath(String id) => '/connectors/skills/$id';
  static String skillEditPath(String id) => '/connectors/skills/$id/edit';

  // Knowledge
  static const String knowledge = '/connectors/knowledge';
  static const String knowledgeNew = '/connectors/knowledge/new';
  static const String knowledgeDetail = '/connectors/knowledge/:id';
  static String knowledgeDetailPath(String id) => '/connectors/knowledge/$id';

  // Memory
  static const String memory = '/connectors/memory';

  // Kept for compatibility (redirects to /marketplace)
  static const String dashboard = '/marketplace';
}
