import 'package:clerk_flutter/clerk_flutter.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../auth/global_auth_notifier.dart';
import '../config/storage_keys.dart';
import '../storage/local_storage.dart';
import '../../features/auth/presentation/pages/auth_page.dart';
import '../../features/onboarding/presentation/pages/onboarding_page.dart';
import '../../features/shell/presentation/pages/main_shell.dart';
import '../../features/agent_marketplace/presentation/pages/marketplace_screen.dart';
import '../../features/agent_marketplace/presentation/pages/agent_detail_screen.dart';
import '../../features/agent_marketplace/presentation/pages/my_agents_screen.dart';
import '../../features/agent_marketplace/presentation/pages/agent_form_screen.dart';
import '../../features/chat_thread/presentation/pages/thread_list_screen.dart';
import '../../features/chat_thread/presentation/pages/chat_screen.dart';
import '../../features/profile/presentation/pages/profile_screen.dart';
import '../../features/provider_keys/presentation/pages/providers_screen.dart';
import '../../features/provider_keys/presentation/pages/provider_form_screen.dart';
import '../../features/mcp_servers/presentation/pages/mcp_list_screen.dart';
import '../../features/mcp_servers/presentation/pages/mcp_form_screen.dart';
import '../../features/skills/presentation/pages/skills_screen.dart';
import '../../features/skills/presentation/pages/skill_form_screen.dart';
import '../../features/knowledge/presentation/pages/knowledge_list_screen.dart';
import '../../features/knowledge/presentation/pages/knowledge_detail_screen.dart';
import 'route_names.dart';

/// GoRouter instance.
///
/// Guard logic:
///   1. Splash and onboarding are always reachable.
///   2. After onboarding, unauthenticated users go to /login.
///   3. Signed-in users are sent to /marketplace when hitting /login.
///
/// [globalAuthNotifier] drives re-evaluation on every auth change.
final router = GoRouter(
  initialLocation: RouteNames.splash,
  refreshListenable: globalAuthNotifier,
  redirect: _authGuard,
  routes: [
    GoRoute(
      path: RouteNames.splash,
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: RouteNames.onboarding,
      builder: (context, state) => const OnboardingPage(),
    ),
    GoRoute(
      path: RouteNames.login,
      builder: (context, state) => const AuthPage(),
    ),

    // ── Main shell ─────────────────────────────────────────────────────────────
    ShellRoute(
      builder: (context, state, child) => MainShell(child: child),
      routes: [
        // ── Marketplace tab ───────────────────────────────────────────────────
        GoRoute(
          path: RouteNames.marketplace,
          builder: (context, state) => const MarketplaceScreen(),
          routes: [
            GoRoute(
              path: 'agents/:id',
              builder: (context, state) => AgentDetailScreen(
                agentId: state.pathParameters['id']!,
              ),
            ),
          ],
        ),

        // ── Chats tab ─────────────────────────────────────────────────────────
        GoRoute(
          path: RouteNames.chats,
          builder: (context, state) => const ThreadListScreen(),
          routes: [
            GoRoute(
              path: ':threadId',
              builder: (context, state) => ChatScreen(
                threadId: state.pathParameters['threadId']!,
                agentId: state.uri.queryParameters['agentId'] ?? '',
              ),
            ),
          ],
        ),

        // ── My Agents tab ─────────────────────────────────────────────────────
        GoRoute(
          path: RouteNames.myAgents,
          builder: (context, state) => const MyAgentsScreen(),
          routes: [
            GoRoute(
              path: 'new',
              builder: (context, state) => const AgentFormScreen(),
            ),
            GoRoute(
              path: ':id/edit',
              builder: (context, state) => AgentFormScreen(
                agentId: state.pathParameters['id'],
              ),
            ),
          ],
        ),

        // ── Profile tab ───────────────────────────────────────────────────────
        GoRoute(
          path: RouteNames.profile,
          builder: (context, state) => const ProfileScreen(),
          routes: [
            GoRoute(
              path: 'providers',
              builder: (context, state) => const ProvidersScreen(),
              routes: [
                GoRoute(
                  path: 'new',
                  builder: (context, state) => const ProviderFormScreen(),
                ),
                GoRoute(
                  path: ':id',
                  builder: (context, state) => ProviderFormScreen(
                    providerId: state.pathParameters['id'],
                  ),
                ),
              ],
            ),
            GoRoute(
              path: 'mcps',
              builder: (context, state) => const McpListScreen(),
              routes: [
                GoRoute(
                  path: 'new',
                  builder: (context, state) => const McpFormScreen(),
                ),
                GoRoute(
                  path: ':id',
                  builder: (context, state) => McpFormScreen(
                    mcpId: state.pathParameters['id'],
                  ),
                ),
              ],
            ),
            GoRoute(
              path: 'skills',
              builder: (context, state) => const SkillsScreen(),
              routes: [
                GoRoute(
                  path: 'new',
                  builder: (context, state) => const SkillFormScreen(),
                ),
                GoRoute(
                  path: ':id',
                  builder: (context, state) => SkillFormScreen(
                    skillId: state.pathParameters['id'],
                  ),
                ),
              ],
            ),
            GoRoute(
              path: 'knowledge',
              builder: (context, state) => const KnowledgeListScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (context, state) => KnowledgeDetailScreen(
                    kbId: state.pathParameters['id']!,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
  ],
);

String? _authGuard(BuildContext context, GoRouterState state) {
  final location = state.matchedLocation;

  if (location == RouteNames.splash || location == RouteNames.onboarding) {
    return null;
  }

  final onboardingDone =
      LocalStorage.getBool(StorageKeys.onboardingComplete) ?? false;

  if (!onboardingDone) {
    return location == RouteNames.onboarding ? null : RouteNames.onboarding;
  }

  final isSignedIn = globalAuthNotifier.value;

  if (!isSignedIn && location != RouteNames.login) {
    return RouteNames.login;
  }

  if (isSignedIn && location == RouteNames.login) {
    return RouteNames.marketplace;
  }

  return null;
}

// ── Splash Screen ─────────────────────────────────────────────────────────────

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigate();
  }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;

    final onboardingDone =
        LocalStorage.getBool(StorageKeys.onboardingComplete) ?? false;

    if (!onboardingDone) {
      context.go(RouteNames.onboarding);
      return;
    }

    ClerkAuthState? authState;
    try {
      authState = ClerkAuth.of(context);
    } catch (_) {}

    if (authState != null && authState.isNotAvailable) {
      for (var i = 0; i < 20; i++) {
        await Future.delayed(const Duration(milliseconds: 100));
        if (!mounted) return;
        if (!authState.isNotAvailable) break;
      }
    }

    if (!mounted) return;
    context.go(RouteNames.marketplace);
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
