import 'package:clerk_flutter/clerk_flutter.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../auth/global_auth_notifier.dart';
import '../config/storage_keys.dart';
import '../storage/local_storage.dart';
import '../../features/auth/presentation/pages/auth_page.dart';
import '../../features/onboarding/presentation/pages/onboarding_page.dart';
import 'route_names.dart';

/// GoRouter instance.
///
/// Route guard logic:
///   1. Splash and onboarding are always reachable (no auth required).
///   2. Once onboarding is complete, unauthenticated users land on /login.
///   3. Authenticated users are bounced away from /login to /dashboard.
///
/// [globalAuthNotifier] is used as [refreshListenable] so the guard
/// re-evaluates on every sign-in / sign-out event.
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
    GoRoute(
      path: RouteNames.dashboard,
      builder: (context, state) =>
          const PlaceholderScreen(title: 'Dashboard'),
    ),
  ],
);

String? _authGuard(BuildContext context, GoRouterState state) {
  final location = state.matchedLocation;

  // Splash and onboarding handle their own navigation
  if (location == RouteNames.splash || location == RouteNames.onboarding) {
    return null;
  }

  final onboardingDone =
      LocalStorage.getBool(StorageKeys.onboardingComplete) ?? false;

  // Onboarding must be completed before anything else
  if (!onboardingDone) {
    return location == RouteNames.onboarding ? null : RouteNames.onboarding;
  }

  final isSignedIn = globalAuthNotifier.value;

  // Unauthenticated users can only be on the login page
  if (!isSignedIn && location != RouteNames.login) {
    return RouteNames.login;
  }

  // Signed-in users must not linger on the login page
  if (isSignedIn && location == RouteNames.login) {
    return RouteNames.dashboard;
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
    // Minimum splash display time
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;

    final onboardingDone =
        LocalStorage.getBool(StorageKeys.onboardingComplete) ?? false;

    if (!onboardingDone) {
      context.go(RouteNames.onboarding);
      return;
    }

    // Wait for Clerk to finish restoring the session (isNotAvailable → false).
    // ClerkAuthState is accessible via ClerkAuth.of(context) once ClerkAuth
    // is in the tree (it is — it wraps PersonaApp → MaterialApp → this route).
    ClerkAuthState? authState;
    try {
      authState = ClerkAuth.of(context);
    } catch (_) {}

    if (authState != null && authState.isNotAvailable) {
      // Poll briefly until initialisation completes (typically < 200 ms)
      for (var i = 0; i < 20; i++) {
        await Future.delayed(const Duration(milliseconds: 100));
        if (!mounted) return;
        if (!authState.isNotAvailable) break;
      }
    }

    if (!mounted) return;

    // GoRouter redirect will pick the correct destination once we leave splash
    context.go(RouteNames.dashboard);
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}

// ── Placeholder Dashboard ─────────────────────────────────────────────────────

class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () async {
              final authState = ClerkAuth.of(context);
              await authState.signOut();
            },
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            TextButton(
              onPressed: () async {
                await LocalStorage.setBool(
                  StorageKeys.onboardingComplete,
                  value: false,
                );
                if (context.mounted) context.go(RouteNames.splash);
              },
              child: const Text('Reset onboarding flag (dev)'),
            ),
          ],
        ),
      ),
    );
  }
}
