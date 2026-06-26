import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'route_names.dart';
import '../../features/onboarding/presentation/pages/onboarding_page.dart';
import '../storage/local_storage.dart';
import '../config/storage_keys.dart';

final router = GoRouter(
  initialLocation: RouteNames.splash,
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
      builder: (context, state) => const PlaceholderScreen(title: 'Login Screen'),
    ),
    GoRoute(
      path: RouteNames.dashboard,
      builder: (context, state) => const PlaceholderScreen(title: 'Dashboard Screen'),
    ),
  ],
);

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkOnboarding();
  }

  Future<void> _checkOnboarding() async {
    try {
      // Wait for a second to show splash
      await Future.delayed(const Duration(milliseconds: 1000));
      if (!mounted) return;

      final onboardingComplete = LocalStorage.getBool(StorageKeys.onboardingComplete) ?? false;
      if (onboardingComplete) {
        context.go(RouteNames.login);
      } else {
        context.go(RouteNames.onboarding);
      }
    } catch (e, stack) {
      debugPrint('Error during onboarding check: $e');
      debugPrint(stack.toString());
      if (mounted) {
        // Safe fallback so the screen doesn't hang
        context.go(RouteNames.onboarding);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}

class PlaceholderScreen extends StatelessWidget {
  final String title;
  const PlaceholderScreen({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        automaticallyImplyLeading: false,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              if (title == 'Login Screen') ...[
                const SizedBox(height: 40),
                ElevatedButton(
                  onPressed: () async {
                    await LocalStorage.setBool(StorageKeys.onboardingComplete, value: false);
                    if (context.mounted) {
                      context.go(RouteNames.splash);
                    }
                  },
                  child: const Text('Go back to Onboarding (Reset Flag)'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
