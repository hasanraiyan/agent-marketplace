import 'package:clerk_flutter/clerk_flutter.dart';

/// Holds a reference to [ClerkAuthState] so that Dio interceptors can
/// retrieve a fresh session token without requiring a [BuildContext].
///
/// Set by [ClerkAuthBridge] on every auth-state change; cleared on sign-out.
class ClerkTokenStore {
  ClerkTokenStore._();
  static final ClerkTokenStore instance = ClerkTokenStore._();

  ClerkAuthState? _authState;

  void setAuthState(ClerkAuthState? state) => _authState = state;

  /// Returns the active Clerk session JWT, or `null` when signed out.
  ///
  /// Clerk handles token caching and refresh internally; calling this always
  /// yields a valid (or freshly-minted) token while a session is active.
  Future<String?> getToken() async {
    final state = _authState;
    if (state == null || !state.isSignedIn) return null;
    try {
      final sessionToken = await state.sessionToken();
      // SessionToken.jwt is the raw JWT string from clerk_auth
      return sessionToken.jwt;
    } catch (_) {
      return null;
    }
  }
}
