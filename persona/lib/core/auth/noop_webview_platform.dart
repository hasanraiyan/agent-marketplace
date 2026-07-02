import 'package:flutter/material.dart';
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart';

/// A no-op [WebViewPlatform] implementation for desktop targets (Windows) where
/// `webview_flutter` has no native plugin.
///
/// Why this exists: `clerk_flutter` constructs a [WebViewCookieManager] and a
/// [WebViewController] eagerly during auth-state evaluation (e.g. to clear SSO
/// cookies). On Windows there is no registered `WebViewPlatform.instance`, so
/// those calls throw a "platform implementation has not been set" assertion that
/// crashes the auth screen before it can render.
///
/// Registering this shim lets email/password sign-in (which talks to the Clerk
/// API directly, not the webview) work on Windows. SSO/OAuth popups that need a
/// real embedded browser render an "unsupported" placeholder instead of crashing.
///
/// This is **only** registered on Windows from `main()`; Android/iOS keep their
/// real native webview implementations untouched.
class NoopWebViewPlatform extends WebViewPlatform {
  /// Registers this shim as the global [WebViewPlatform.instance].
  static void registerWith() {
    WebViewPlatform.instance = NoopWebViewPlatform();
  }

  @override
  PlatformWebViewController createPlatformWebViewController(
    PlatformWebViewControllerCreationParams params,
  ) =>
      _NoopWebViewController(params);

  @override
  PlatformWebViewWidget createPlatformWebViewWidget(
    PlatformWebViewWidgetCreationParams params,
  ) =>
      _NoopWebViewWidget(params);

  @override
  PlatformNavigationDelegate createPlatformNavigationDelegate(
    PlatformNavigationDelegateCreationParams params,
  ) =>
      _NoopNavigationDelegate(params);

  @override
  PlatformWebViewCookieManager createPlatformCookieManager(
    PlatformWebViewCookieManagerCreationParams params,
  ) =>
      _NoopCookieManager(params);
}

// ── Controller ────────────────────────────────────────────────────────────────
// Overrides every method clerk_flutter touches so they resolve to harmless
// no-ops instead of the base class's UnimplementedError throws.

class _NoopWebViewController extends PlatformWebViewController {
  _NoopWebViewController(super.params) : super.implementation();

  @override
  Future<void> setJavaScriptMode(JavaScriptMode javaScriptMode) async {}

  @override
  Future<void> setBackgroundColor(Color color) async {}

  @override
  Future<void> setPlatformNavigationDelegate(
    PlatformNavigationDelegate handler,
  ) async {}

  @override
  Future<void> loadRequest(LoadRequestParams params) async {}

  @override
  Future<void> setUserAgent(String? userAgent) async {}
}

// ── Navigation delegate ─────────────────────────────────────────────────────

class _NoopNavigationDelegate extends PlatformNavigationDelegate {
  _NoopNavigationDelegate(super.params) : super.implementation();

  @override
  Future<void> setOnNavigationRequest(
    NavigationRequestCallback onNavigationRequest,
  ) async {}

  @override
  Future<void> setOnPageStarted(PageEventCallback onPageStarted) async {}

  @override
  Future<void> setOnPageFinished(PageEventCallback onPageFinished) async {}

  @override
  Future<void> setOnProgress(ProgressCallback onProgress) async {}

  @override
  Future<void> setOnWebResourceError(
    WebResourceErrorCallback onWebResourceError,
  ) async {}

  @override
  Future<void> setOnUrlChange(UrlChangeCallback onUrlChange) async {}
}

// ── Cookie manager ────────────────────────────────────────────────────────────

class _NoopCookieManager extends PlatformWebViewCookieManager {
  _NoopCookieManager(super.params) : super.implementation();

  @override
  Future<bool> clearCookies() async => false;

  @override
  Future<void> setCookie(WebViewCookie cookie) async {}
}

// ── Widget ────────────────────────────────────────────────────────────────────

class _NoopWebViewWidget extends PlatformWebViewWidget {
  _NoopWebViewWidget(super.params) : super.implementation();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFF1C1917),
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'In-app browser is not supported on this platform.\n'
            'Please use email & password sign-in.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ),
      ),
    );
  }
}
