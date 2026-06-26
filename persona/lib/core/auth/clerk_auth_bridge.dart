import 'package:clerk_flutter/clerk_flutter.dart';
import 'package:flutter/material.dart';

import 'clerk_token_store.dart';
import 'global_auth_notifier.dart';

/// Invisible widget that keeps [globalAuthNotifier] and [ClerkTokenStore]
/// in sync with [ClerkAuthState].
///
/// Place it immediately inside [ClerkAuth] and above [MaterialApp] so it
/// is always mounted and the GoRouter [refreshListenable] fires on every
/// sign-in / sign-out transition.
class ClerkAuthBridge extends StatefulWidget {
  const ClerkAuthBridge({super.key, required this.child});

  final Widget child;

  @override
  State<ClerkAuthBridge> createState() => _ClerkAuthBridgeState();
}

class _ClerkAuthBridgeState extends State<ClerkAuthBridge> {
  @override
  Widget build(BuildContext context) {
    return ClerkAuthBuilder(
      signedInBuilder: (context, authState) {
        _sync(authState, isSignedIn: true);
        return widget.child;
      },
      signedOutBuilder: (context, authState) {
        _sync(authState, isSignedIn: false);
        return widget.child;
      },
    );
  }

  void _sync(ClerkAuthState authState, {required bool isSignedIn}) {
    // Always keep the token store up-to-date (safe during build — no setState)
    ClerkTokenStore.instance.setAuthState(authState);

    // Defer ValueNotifier mutation to after the current build frame
    if (!authState.isNotAvailable) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && globalAuthNotifier.value != isSignedIn) {
          globalAuthNotifier.value = isSignedIn;
        }
      });
    }
  }
}
