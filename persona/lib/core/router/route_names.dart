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

  static const String mcps = '/profile/mcps';
  static const String mcpNew = '/profile/mcps/new';
  static const String mcpEdit = '/profile/mcps/:id';
  static String mcpEditPath(String id) => '/profile/mcps/$id';

  static const String skills = '/profile/skills';
  static const String skillNew = '/profile/skills/new';
  static const String skillEdit = '/profile/skills/:id';
  static String skillEditPath(String id) => '/profile/skills/$id';

  static const String knowledge = '/profile/knowledge';
  static const String knowledgeDetail = '/profile/knowledge/:id';
  static String knowledgeDetailPath(String id) => '/profile/knowledge/$id';

  // Kept for compatibility (redirects to /marketplace)
  static const String dashboard = '/marketplace';
}
