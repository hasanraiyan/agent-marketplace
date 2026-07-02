import 'package:clerk_flutter/clerk_flutter.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import 'core/auth/clerk_auth_bridge.dart';
import 'core/auth/noop_webview_platform.dart';
import 'core/router/router.dart';
import 'core/storage/local_storage.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Windows has no native webview_flutter plugin, but clerk_flutter constructs a
  // WebView/cookie manager during auth-state evaluation. Register a no-op shim so
  // the auth screen renders instead of crashing. Android/iOS keep the real one.
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.windows) {
    NoopWebViewPlatform.registerWith();
  }

  try {
    await dotenv.load(fileName: '.env');
  } catch (e) {
    debugPrint('Could not load .env file: $e');
  }

  await LocalStorage.init();

  runApp(
    const ProviderScope(
      child: PersonaApp(),
    ),
  );
}

class PersonaApp extends StatelessWidget {
  const PersonaApp({super.key});

  @override
  Widget build(BuildContext context) {
    final publishableKey = dotenv.env['CLERK_PUBLISHABLE_KEY'] ?? '';

    return ClerkAuth(
      // Only publishableKey is required for email/password auth.
      // When adding OAuth (Google, Apple, GitHub), pass:
      //   redirectionGenerator: (ctx, s) =>
      //       Uri(scheme: 'clerk', host: 'com.persona.ai.callback'),
      //   deepLinkStream: AppLinks().uriLinkStream.asyncMap(...),
      // clerk://com.persona.ai.callback is already registered in the Dashboard.
      config: ClerkAuthConfig(publishableKey: publishableKey),
      child: ClerkAuthBridge(
        child: ScreenUtilInit(
          designSize: const Size(375, 812),
          minTextAdapt: true,
          splitScreenMode: true,
          builder: (context, child) {
            return MaterialApp.router(
              title: 'Persona.ai',
              debugShowCheckedModeBanner: false,
              theme: AppTheme.light,
              darkTheme: AppTheme.dark,
              themeMode: ThemeMode.system,
              routerConfig: router,
            );
          },
        ),
      ),
    );
  }
}
